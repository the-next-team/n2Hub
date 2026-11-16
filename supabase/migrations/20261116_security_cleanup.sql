-- ═══════════════════════════════════════════════════════════════════════════
-- n2Hub 보안 정리 (20261116_init_schema.sql 적용 뒤 1회 실행)
--
-- 실행 위치 : Supabase 대시보드 → SQL Editor → 전체 붙여넣기 → Run
-- 재실행    : 안전합니다.
-- 하는 일   : 새 정책이 들어오기 전에 있던 느슨한 예전 정책·권한을 지웁니다.
--             테이블과 데이터는 건드리지 않습니다.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. 예전 테이블 정책 삭제 (같은 범위의 새 정책이 이미 적용되어 있음)
drop policy if exists "project actions"       on public.action_items;
drop policy if exists "project comments"      on public.comments;
drop policy if exists "project doc versions"  on public.document_versions;
drop policy if exists "project documents"     on public.documents;
drop policy if exists "file sessions"         on public.file_sessions;
drop policy if exists "delete project files"  on public.files;
drop policy if exists "insert project files"  on public.files;
drop policy if exists "select project files"  on public.files;
drop policy if exists "update project files"  on public.files;
drop policy if exists "project issues"        on public.issues;
drop policy if exists "project milestones"    on public.milestones;
drop policy if exists "own notifications"     on public.notifications;
drop policy if exists "own profile"           on public.profiles;
drop policy if exists "manage members"        on public.project_members;
drop policy if exists "select members"        on public.project_members;
drop policy if exists "delete own projects"   on public.projects;
drop policy if exists "insert projects"       on public.projects;
drop policy if exists "select own projects"   on public.projects;
drop policy if exists "update own projects"   on public.projects;
drop policy if exists "project sprints"       on public.sprints;
drop policy if exists "project wbs"           on public.wbs_tasks;

-- 2. 예전 스토리지 정책 삭제
--    (로그인만 하면 누구나 documents 버킷의 모든 파일을 읽고 지울 수 있었음)
drop policy if exists "delete documents" on storage.objects;
drop policy if exists "read documents"   on storage.objects;
drop policy if exists "update documents" on storage.objects;
drop policy if exists "upload documents" on storage.objects;
drop policy if exists "read logos"       on storage.objects;
drop policy if exists "upload logos"     on storage.objects;

-- 3. 앱 코드가 쓰지 않는 테이블 : 프로젝트 멤버 기준으로 정책 교체
drop policy if exists "project doc comments" on public.document_comments;
create policy "document_comments member" on public.document_comments
  for all to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "project meetings" on public.meetings;
create policy "meetings member" on public.meetings
  for all to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

drop policy if exists "project workflow history" on public.workflow_history;
create policy "workflow_history member" on public.workflow_history
  for all to authenticated
  using (public.is_project_member(project_id))
  with check (public.is_project_member(project_id));

-- file_save_queue : 로그인한 누구나 읽고 쓸 수 있던 정책 삭제.
-- 정책이 없으면 서버(service_role)만 접근할 수 있습니다.
drop policy if exists "oo save queue" on public.file_save_queue;

-- 4. 비로그인(anon) 테이블 권한 회수
do $$
declare
  t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on public.%I from anon', t);
  end loop;
end;
$$;

-- 5. 함수 실행 권한 정리
--    권한 확인 함수는 로그인 사용자만, 트리거 전용 함수는 API 호출 불가
revoke execute on function public.is_project_member(uuid)  from public, anon;
revoke execute on function public.is_project_pm(uuid)      from public, anon;
revoke execute on function public.is_project_manager(uuid) from public, anon;
revoke execute on function public.handle_new_user()        from public, anon, authenticated;
revoke execute on function public.handle_new_project()     from public, anon, authenticated;
revoke execute on function public.set_updated_at()         from public, anon, authenticated;
revoke execute on function public.wbs_tasks_before_write() from public, anon, authenticated;

-- 6. 가입 트리거 : 이메일 변경 시에도 profiles 가 따라오도록 교체
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update of email on auth.users
  for each row execute function public.handle_new_user();
