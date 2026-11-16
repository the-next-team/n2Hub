-- ═══════════════════════════════════════════════════════════════════════════
-- n2Hub 초기 스키마 (새 Supabase 프로젝트용 전체 설치 스크립트)
--
-- 실행 위치 : Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 재실행    : 안전합니다. 이미 있는 테이블/데이터는 건드리지 않고
--             함수·트리거·정책만 최신 내용으로 다시 만듭니다.
-- 근거      : the-next-team/n2Hub (commit 21a5ef8) 의 src/ 코드가 실제로
--             읽고 쓰는 테이블·컬럼·버킷을 기준으로 작성했습니다.
-- 저장 위치 : supabase/migrations/20261116_init_schema.sql 로 커밋해 두세요.
--             (기존 20260528_*.sql 3개의 내용은 이 파일에 모두 포함되어 있어
--              새 프로젝트에서는 이 파일 하나만 실행하면 됩니다.)
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
-- 1. 테이블
-- ───────────────────────────────────────────────────────────────────────────

-- 사용자 프로필 (멤버 초대 시 이메일 검색에 사용, 가입 시 트리거로 자동 생성)
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text,
  display_name text,
  created_at   timestamptz not null default now()
);
create index if not exists profiles_email_idx on public.profiles (email);

-- 프로젝트
create table if not exists public.projects (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  description      text,
  client_name      text,
  start_date       date,
  end_date         date,
  status           text not null default 'active' check (status in ('active', 'archived')),
  system_code      text,
  system_name      text,
  logo_url         text,
  theme_color      text,
  parts            jsonb not null default '[]'::jsonb,   -- 파트 이름 배열
  role_permissions jsonb not null default '{}'::jsonb,   -- 역할별 권한 맵
  created_by       uuid default auth.uid() references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- 프로젝트 멤버 (역할: pm / pl / developer / qa)
create table if not exists public.project_members (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references public.projects(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  role         text not null default 'developer' check (role in ('pm', 'pl', 'developer', 'qa')),
  display_name text,
  part         text,
  created_at   timestamptz not null default now(),
  unique (project_id, user_id)
);
create index if not exists project_members_user_id_idx on public.project_members (user_id);

-- 스프린트
create table if not exists public.sprints (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       text not null,
  goal       text,
  start_date date,
  end_date   date,
  status     text not null default 'planning' check (status in ('planning', 'active', 'completed')),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists sprints_project_id_idx on public.sprints (project_id);

-- WBS 작업
create table if not exists public.wbs_tasks (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  wbs_code         text not null default '',
  wbs_level        integer not null default 1,
  task_name        text not null default '',
  start_date       date,
  end_date         date,
  planned_progress numeric not null default 0,
  actual_progress  numeric not null default 0,
  assignee_name    text,
  assignee_user_id uuid references auth.users(id) on delete set null,
  -- 코드가 assignee_id(오늘 할 일, 멤버 통계)와 assignee_user_id(작업 보드)를
  -- 섞어 쓰고 있어, 아래 트리거가 assignee_id 를 assignee_user_id 와 같게 유지합니다.
  assignee_id      uuid references auth.users(id) on delete set null,
  status           text not null default 'not_started'
                     check (status in ('not_started', 'in_progress', 'completed', 'delayed')),
  notes            text,
  sprint_id        uuid references public.sprints(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists wbs_tasks_project_id_idx on public.wbs_tasks (project_id);
create index if not exists wbs_tasks_assignee_idx   on public.wbs_tasks (assignee_user_id);
create index if not exists wbs_tasks_sprint_id_idx  on public.wbs_tasks (sprint_id);

-- 산출물(에디터 문서)
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references public.projects(id) on delete cascade,
  title           text not null,
  description     text,
  category        text,
  status          text not null default '작성중',
  assignee_id     uuid references auth.users(id) on delete set null,
  due_date        date,
  current_version text not null default 'v1.0',
  created_by      uuid default auth.uid() references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists documents_project_id_idx on public.documents (project_id);

-- 산출물 버전
create table if not exists public.document_versions (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references public.documents(id) on delete cascade,
  version      text not null,
  content_json jsonb,
  change_note  text,
  created_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists document_versions_document_id_idx on public.document_versions (document_id);

-- 파일함 (폴더는 mime_type = 'folder' 인 행)
create table if not exists public.files (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  original_name text not null,
  folder_path   text not null default '',
  storage_path  text not null default '',
  size          bigint not null default 0,
  mime_type     text,
  version       text,
  task_id       uuid references public.wbs_tasks(id) on delete set null,
  uploaded_by   uuid default auth.uid() references auth.users(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists files_project_folder_idx on public.files (project_id, folder_path);
create index if not exists files_task_id_idx        on public.files (task_id);

-- 파일 열람 세션 (누가 같은 파일을 보고 있는지)
create table if not exists public.file_sessions (
  id         uuid primary key default gen_random_uuid(),
  file_id    uuid not null references public.files(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  user_email text not null default '',
  user_name  text not null default '',
  created_at timestamptz not null default now(),
  unique (file_id, user_id)
);

-- 이슈
create table if not exists public.issues (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  title         varchar(500) not null,
  description   text,
  type          varchar(20) not null default 'task'
                  check (type in ('bug', 'feature', 'task', 'improvement')),
  priority      varchar(10) not null default 'medium'
                  check (priority in ('critical', 'high', 'medium', 'low')),
  status        varchar(20) not null default 'open'
                  check (status in ('open', 'in_progress', 'resolved', 'closed')),
  assignee_id   uuid references auth.users(id) on delete set null,
  assignee_name varchar(255),
  reporter_id   uuid not null references auth.users(id) on delete cascade,
  reporter_name varchar(255) not null default '',
  due_date      date,
  sprint_id     uuid references public.sprints(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists issues_project_id_idx on public.issues (project_id);
create index if not exists issues_status_idx     on public.issues (status);
create index if not exists issues_due_date_idx   on public.issues (due_date);
create index if not exists issues_sprint_id_idx  on public.issues (sprint_id);

-- 마일스톤
create table if not exists public.milestones (
  id         uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name       varchar(255) not null,
  due_date   date,
  status     varchar(20) not null default 'planned' check (status in ('planned', 'done', 'missed')),
  created_at timestamptz not null default now()
);
create index if not exists milestones_project_id_idx on public.milestones (project_id);
create index if not exists milestones_due_date_idx   on public.milestones (due_date);

-- 댓글 (target_type: 'task' | 'file' | 'issue')
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects(id) on delete cascade,
  target_type varchar(20) not null,
  target_id   uuid not null,
  body        text not null check (char_length(body) > 0),
  author_id   uuid not null references auth.users(id) on delete cascade,
  author_name varchar(255) not null default '',
  created_at  timestamptz not null default now()
);
create index if not exists comments_target_idx     on public.comments (target_type, target_id);
create index if not exists comments_project_id_idx on public.comments (project_id);

-- 액션 아이템
create table if not exists public.action_items (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references public.projects(id) on delete cascade,
  title          text not null,
  description    text,
  assignee_id    uuid references auth.users(id) on delete set null,
  assignee_name  text,
  due_date       date,
  status         text not null default 'pending' check (status in ('pending', 'in_progress', 'completed')),
  source         text not null default 'manual' check (source in ('manual', 'meeting')),
  meeting_doc_id uuid,
  issue_id       uuid references public.issues(id) on delete set null,
  created_by     uuid default auth.uid() references auth.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  completed_at   timestamptz
);
create index if not exists action_items_project_id_idx on public.action_items (project_id);
create index if not exists action_items_assignee_idx   on public.action_items (assignee_id);

-- 사용자 정의 템플릿 (기본 제공 템플릿은 프론트 코드에 내장)
create table if not exists public.templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  category     text not null default '기타',
  content_text text,
  is_public    boolean not null default false,
  created_by   uuid default auth.uid() references auth.users(id) on delete cascade,
  created_at   timestamptz not null default now()
);

-- 알림
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text,
  link       text,
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);


-- ───────────────────────────────────────────────────────────────────────────
-- 2. 권한 확인용 함수
--    SECURITY DEFINER 로 만들어 정책이 project_members 를 다시 조회할 때
--    생기는 "infinite recursion detected in policy" 를 피합니다.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.is_project_member(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_project_pm(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = (select auth.uid()) and m.role = 'pm'
  );
$$;

-- PM 또는 PL
create or replace function public.is_project_manager(p_project_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.project_members m
    where m.project_id = p_project_id and m.user_id = (select auth.uid()) and m.role in ('pm', 'pl')
  );
$$;

-- 문자열을 uuid 로 바꾸되 형식이 아니면 null (스토리지 경로 검사용)
create or replace function public.try_uuid(p_text text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end;
$$;

revoke execute on function public.is_project_member(uuid)  from public, anon;
revoke execute on function public.is_project_pm(uuid)      from public, anon;
revoke execute on function public.is_project_manager(uuid) from public, anon;
grant  execute on function public.is_project_member(uuid)  to authenticated;
grant  execute on function public.is_project_pm(uuid)      to authenticated;
grant  execute on function public.is_project_manager(uuid) to authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 3. 트리거
-- ───────────────────────────────────────────────────────────────────────────

-- 3-1. 가입 시 profiles 행 자동 생성 (앱 코드는 profiles 에 직접 쓰지 않음)
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();

-- 이미 가입된 계정이 있다면 프로필 채우기
insert into public.profiles (id, email, display_name)
select u.id, lower(u.email),
       coalesce(nullif(u.raw_user_meta_data ->> 'display_name', ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;

-- 3-2. 프로젝트 생성 시 생성자를 PM 으로 자동 등록
--      (앱 코드는 프로젝트만 insert 하고 멤버 행은 넣지 않음)
create or replace function public.handle_new_project()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.created_by is not null then
    insert into public.project_members (project_id, user_id, role, display_name)
    values (
      new.id, new.created_by, 'pm',
      (select coalesce(p.display_name, split_part(p.email, '@', 1))
         from public.profiles p where p.id = new.created_by)
    )
    on conflict (project_id, user_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists on_project_created on public.projects;
create trigger on_project_created
  after insert on public.projects
  for each row execute function public.handle_new_project();

-- 3-3. updated_at 자동 갱신
create or replace function public.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists issues_updated_at_trigger on public.issues;
create trigger issues_updated_at_trigger
  before update on public.issues
  for each row execute function public.set_updated_at();

drop trigger if exists documents_updated_at_trigger on public.documents;
create trigger documents_updated_at_trigger
  before update on public.documents
  for each row execute function public.set_updated_at();

-- 3-4. wbs_tasks.assignee_id 를 assignee_user_id 와 동기화 + updated_at
create or replace function public.wbs_tasks_before_write()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.assignee_id = new.assignee_user_id;
  if tg_op = 'UPDATE' then
    new.updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists wbs_tasks_before_write_trigger on public.wbs_tasks;
create trigger wbs_tasks_before_write_trigger
  before insert or update on public.wbs_tasks
  for each row execute function public.wbs_tasks_before_write();

-- 트리거 전용 함수는 API 로 직접 호출하지 못하게 막기
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.handle_new_project()     from public, anon, authenticated;
revoke execute on function public.set_updated_at()         from public, anon, authenticated;
revoke execute on function public.wbs_tasks_before_write() from public, anon, authenticated;


-- ───────────────────────────────────────────────────────────────────────────
-- 4. 테이블 접근 권한 + RLS 켜기
--    로그인한 사용자(authenticated)만 접근, 비로그인(anon)은 차단.
--    실제로 어떤 행을 볼 수 있는지는 5번의 정책이 결정합니다.
-- ───────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'projects', 'project_members', 'sprints', 'wbs_tasks',
    'documents', 'document_versions', 'files', 'file_sessions', 'issues',
    'milestones', 'comments', 'action_items', 'templates', 'notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- 5. RLS 정책
-- ───────────────────────────────────────────────────────────────────────────

-- 5-1. profiles : 로그인 사용자는 조회 가능(멤버 초대 시 이메일 검색에 필요),
--                 수정은 본인 것만.
drop policy if exists "profiles select" on public.profiles;
create policy "profiles select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- 5-2. projects
--   select 에 created_by 조건이 있는 이유: insert().select() 가 결과를 돌려줄 때
--   멤버 등록 트리거보다 먼저 조회 정책을 검사하기 때문입니다.
drop policy if exists "projects select" on public.projects;
create policy "projects select" on public.projects
  for select to authenticated
  using (created_by = (select auth.uid()) or public.is_project_member(id));

drop policy if exists "projects insert" on public.projects;
create policy "projects insert" on public.projects
  for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "projects update" on public.projects;
create policy "projects update" on public.projects
  for update to authenticated
  using (public.is_project_manager(id)) with check (public.is_project_manager(id));

drop policy if exists "projects delete" on public.projects;
create policy "projects delete" on public.projects
  for delete to authenticated
  using (public.is_project_pm(id));

-- 5-3. project_members : 조회는 같은 프로젝트 멤버, 초대는 PM/PL,
--                        역할 변경·삭제는 PM (본인 탈퇴는 허용)
drop policy if exists "project_members select" on public.project_members;
create policy "project_members select" on public.project_members
  for select to authenticated
  using (public.is_project_member(project_id));

drop policy if exists "project_members insert" on public.project_members;
create policy "project_members insert" on public.project_members
  for insert to authenticated
  with check (public.is_project_manager(project_id));

drop policy if exists "project_members update" on public.project_members;
create policy "project_members update" on public.project_members
  for update to authenticated
  using (public.is_project_pm(project_id)) with check (public.is_project_pm(project_id));

drop policy if exists "project_members delete" on public.project_members;
create policy "project_members delete" on public.project_members
  for delete to authenticated
  using (public.is_project_pm(project_id) or user_id = (select auth.uid()));

-- 5-4. 프로젝트 단위 테이블 : 프로젝트 멤버면 조회·등록·수정·삭제 가능
do $$
declare
  t text;
begin
  foreach t in array array[
    'sprints', 'wbs_tasks', 'documents', 'files', 'milestones', 'action_items'
  ] loop
    execute format('drop policy if exists "%s select" on public.%I', t, t);
    execute format('drop policy if exists "%s insert" on public.%I', t, t);
    execute format('drop policy if exists "%s update" on public.%I', t, t);
    execute format('drop policy if exists "%s delete" on public.%I', t, t);

    execute format(
      'create policy "%s select" on public.%I for select to authenticated
         using (public.is_project_member(project_id))', t, t);
    execute format(
      'create policy "%s insert" on public.%I for insert to authenticated
         with check (public.is_project_member(project_id))', t, t);
    execute format(
      'create policy "%s update" on public.%I for update to authenticated
         using (public.is_project_member(project_id))
         with check (public.is_project_member(project_id))', t, t);
    execute format(
      'create policy "%s delete" on public.%I for delete to authenticated
         using (public.is_project_member(project_id))', t, t);
  end loop;
end;
$$;

-- 5-5. document_versions : 상위 문서의 프로젝트 멤버
drop policy if exists "document_versions select" on public.document_versions;
create policy "document_versions select" on public.document_versions
  for select to authenticated
  using (exists (select 1 from public.documents d
                 where d.id = document_id and public.is_project_member(d.project_id)));

drop policy if exists "document_versions insert" on public.document_versions;
create policy "document_versions insert" on public.document_versions
  for insert to authenticated
  with check (exists (select 1 from public.documents d
                      where d.id = document_id and public.is_project_member(d.project_id)));

drop policy if exists "document_versions update" on public.document_versions;
create policy "document_versions update" on public.document_versions
  for update to authenticated
  using (exists (select 1 from public.documents d
                 where d.id = document_id and public.is_project_member(d.project_id)))
  with check (exists (select 1 from public.documents d
                      where d.id = document_id and public.is_project_member(d.project_id)));

drop policy if exists "document_versions delete" on public.document_versions;
create policy "document_versions delete" on public.document_versions
  for delete to authenticated
  using (exists (select 1 from public.documents d
                 where d.id = document_id and public.is_project_member(d.project_id)));

-- 5-6. file_sessions : 조회는 파일이 속한 프로젝트 멤버, 쓰기는 본인 세션만
drop policy if exists "file_sessions select" on public.file_sessions;
create policy "file_sessions select" on public.file_sessions
  for select to authenticated
  using (exists (select 1 from public.files f
                 where f.id = file_id and public.is_project_member(f.project_id)));

drop policy if exists "file_sessions insert" on public.file_sessions;
create policy "file_sessions insert" on public.file_sessions
  for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.files f
                          where f.id = file_id and public.is_project_member(f.project_id)));

drop policy if exists "file_sessions update" on public.file_sessions;
create policy "file_sessions update" on public.file_sessions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "file_sessions delete" on public.file_sessions;
create policy "file_sessions delete" on public.file_sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- 5-7. issues : 기존 마이그레이션(20260528_issues.sql)과 동일한 규칙
drop policy if exists "select issues" on public.issues;
create policy "select issues" on public.issues
  for select to authenticated using (public.is_project_member(project_id));

drop policy if exists "insert issues" on public.issues;
create policy "insert issues" on public.issues
  for insert to authenticated with check (public.is_project_member(project_id));

drop policy if exists "update issues" on public.issues;
create policy "update issues" on public.issues
  for update to authenticated
  using (public.is_project_member(project_id)) with check (public.is_project_member(project_id));

drop policy if exists "delete issues" on public.issues;
create policy "delete issues" on public.issues
  for delete to authenticated
  using (reporter_id = (select auth.uid()) or public.is_project_pm(project_id));

-- 5-8. comments : 기존 마이그레이션(20260528_comments.sql)과 동일한 규칙
drop policy if exists "select comments" on public.comments;
create policy "select comments" on public.comments
  for select to authenticated using (public.is_project_member(project_id));

drop policy if exists "insert comments" on public.comments;
create policy "insert comments" on public.comments
  for insert to authenticated
  with check (public.is_project_member(project_id) and author_id = (select auth.uid()));

drop policy if exists "delete own comments" on public.comments;
create policy "delete own comments" on public.comments
  for delete to authenticated using (author_id = (select auth.uid()));

-- 5-9. templates : 공개 템플릿 또는 본인이 만든 템플릿
drop policy if exists "templates select" on public.templates;
create policy "templates select" on public.templates
  for select to authenticated
  using (is_public or created_by = (select auth.uid()));

drop policy if exists "templates insert" on public.templates;
create policy "templates insert" on public.templates
  for insert to authenticated
  with check (created_by = (select auth.uid()));

drop policy if exists "templates update" on public.templates;
create policy "templates update" on public.templates
  for update to authenticated
  using (created_by = (select auth.uid())) with check (created_by = (select auth.uid()));

drop policy if exists "templates delete" on public.templates;
create policy "templates delete" on public.templates
  for delete to authenticated
  using (created_by = (select auth.uid()));

-- 5-10. notifications : 내 알림만 조회·읽음 처리·삭제.
--        다른 사람에게 보내는 것은 같은 프로젝트 멤버일 때만.
drop policy if exists "notifications select own" on public.notifications;
create policy "notifications select own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "notifications insert" on public.notifications;
create policy "notifications insert" on public.notifications
  for insert to authenticated
  with check (
    (project_id is not null and public.is_project_member(project_id))
    or (project_id is null and user_id = (select auth.uid()))
  );

drop policy if exists "notifications update own" on public.notifications;
create policy "notifications update own" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "notifications delete own" on public.notifications;
create policy "notifications delete own" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));


-- ───────────────────────────────────────────────────────────────────────────
-- 6. 실시간(Realtime) : 코드가 구독하는 3개 테이블을 publication 에 추가
-- ───────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['notifications', 'file_sessions', 'comments'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;


-- ───────────────────────────────────────────────────────────────────────────
-- 7. 스토리지
--    documents : 비공개. 경로가 "<프로젝트ID>/<uuid>.<확장자>" → 프로젝트 멤버만
--    logos     : 공개. 경로가 "<사용자ID>.<확장자>" 또는 "<프로젝트ID>.<확장자>"
--    avatars   : 공개. 경로가 "<사용자ID>.<확장자>"
-- ───────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false),
       ('logos',     'logos',     true),
       ('avatars',   'avatars',   true)
on conflict (id) do nothing;

-- documents
drop policy if exists "n2hub documents select" on storage.objects;
create policy "n2hub documents select" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents'
         and public.is_project_member(public.try_uuid(split_part(name, '/', 1))));

drop policy if exists "n2hub documents insert" on storage.objects;
create policy "n2hub documents insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents'
              and public.is_project_member(public.try_uuid(split_part(name, '/', 1))));

drop policy if exists "n2hub documents update" on storage.objects;
create policy "n2hub documents update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents'
         and public.is_project_member(public.try_uuid(split_part(name, '/', 1))))
  with check (bucket_id = 'documents'
              and public.is_project_member(public.try_uuid(split_part(name, '/', 1))));

drop policy if exists "n2hub documents delete" on storage.objects;
create policy "n2hub documents delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents'
         and public.is_project_member(public.try_uuid(split_part(name, '/', 1))));

-- logos (공개 URL 조회는 정책 없이 동작. 아래는 업로드·교체·삭제용)
drop policy if exists "n2hub logos select" on storage.objects;
create policy "n2hub logos select" on storage.objects
  for select to authenticated
  using (bucket_id = 'logos');

drop policy if exists "n2hub logos insert" on storage.objects;
create policy "n2hub logos insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'logos' and (
    split_part(name, '.', 1) = (select auth.uid())::text
    or public.is_project_member(public.try_uuid(split_part(name, '.', 1)))
  ));

drop policy if exists "n2hub logos update" on storage.objects;
create policy "n2hub logos update" on storage.objects
  for update to authenticated
  using (bucket_id = 'logos' and (
    split_part(name, '.', 1) = (select auth.uid())::text
    or public.is_project_member(public.try_uuid(split_part(name, '.', 1)))
  ))
  with check (bucket_id = 'logos' and (
    split_part(name, '.', 1) = (select auth.uid())::text
    or public.is_project_member(public.try_uuid(split_part(name, '.', 1)))
  ));

drop policy if exists "n2hub logos delete" on storage.objects;
create policy "n2hub logos delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'logos' and (
    split_part(name, '.', 1) = (select auth.uid())::text
    or public.is_project_member(public.try_uuid(split_part(name, '.', 1)))
  ));

-- avatars (본인 파일만 업로드·교체·삭제)
drop policy if exists "n2hub avatars select" on storage.objects;
create policy "n2hub avatars select" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

drop policy if exists "n2hub avatars insert" on storage.objects;
create policy "n2hub avatars insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);

drop policy if exists "n2hub avatars update" on storage.objects;
create policy "n2hub avatars update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);

drop policy if exists "n2hub avatars delete" on storage.objects;
create policy "n2hub avatars delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and split_part(name, '.', 1) = (select auth.uid())::text);


-- ───────────────────────────────────────────────────────────────────────────
-- 8. 설치 확인 (실행 결과 표에서 15개 테이블과 정책 수가 보이면 성공)
-- ───────────────────────────────────────────────────────────────────────────

select c.relname                                   as table_name,
       c.relrowsecurity                            as rls_enabled,
       (select count(*) from pg_policies p
         where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relname;
