-- ───────────────────────────────────────────────────────────
-- 이슈 테이블 생성
-- Supabase SQL Editor에서 실행하세요.
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS issues (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     uuid         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title          varchar(500) NOT NULL,
  description    text,
  type           varchar(20)  NOT NULL DEFAULT 'task'
                   CHECK (type IN ('bug', 'feature', 'task', 'improvement')),
  priority       varchar(10)  NOT NULL DEFAULT 'medium'
                   CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  status         varchar(20)  NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  assignee_id    uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_name  varchar(255),
  reporter_id    uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reporter_name  varchar(255) NOT NULL DEFAULT '',
  due_date       date,
  created_at     timestamptz  NOT NULL DEFAULT now(),
  updated_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS issues_project_id_idx ON issues(project_id);
CREATE INDEX IF NOT EXISTS issues_status_idx     ON issues(status);
CREATE INDEX IF NOT EXISTS issues_due_date_idx   ON issues(due_date);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_issues_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS issues_updated_at_trigger ON issues;
CREATE TRIGGER issues_updated_at_trigger
  BEFORE UPDATE ON issues
  FOR EACH ROW EXECUTE FUNCTION update_issues_updated_at();

-- RLS 활성화
ALTER TABLE issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select issues" ON issues
  FOR SELECT USING (is_project_member(project_id));

CREATE POLICY "insert issues" ON issues
  FOR INSERT WITH CHECK (is_project_member(project_id));

CREATE POLICY "update issues" ON issues
  FOR UPDATE USING (is_project_member(project_id));

CREATE POLICY "delete issues" ON issues
  FOR DELETE USING (
    reporter_id = auth.uid() OR is_project_pm(project_id)
  );

-- ───────────────────────────────────────────────────────────
-- comments 테이블의 target_type 허용 범위에 'issue' 추가
-- (comments 테이블이 이미 존재하는 경우 실행)
-- ───────────────────────────────────────────────────────────
-- ALTER TABLE comments
--   DROP CONSTRAINT IF EXISTS comments_target_type_check;
-- ALTER TABLE comments
--   ADD CONSTRAINT comments_target_type_check
--   CHECK (target_type IN ('task', 'file', 'issue'));
