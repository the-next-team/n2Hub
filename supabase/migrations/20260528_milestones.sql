-- ───────────────────────────────────────────────────────────
-- 마일스톤 테이블 생성
-- Supabase SQL Editor에서 실행하세요.
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS milestones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        varchar(255) NOT NULL,
  due_date    date,
  status      varchar(20)  NOT NULL DEFAULT 'planned'
                CHECK (status IN ('planned', 'done', 'missed')),
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS milestones_project_id_idx ON milestones(project_id);
CREATE INDEX IF NOT EXISTS milestones_due_date_idx   ON milestones(due_date);

-- RLS 활성화
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;

-- 정책: 프로젝트 멤버만 접근 가능 (is_project_member 함수 재사용)
CREATE POLICY "select milestones" ON milestones
  FOR SELECT USING (is_project_member(project_id));

CREATE POLICY "insert milestones" ON milestones
  FOR INSERT WITH CHECK (is_project_member(project_id));

CREATE POLICY "update milestones" ON milestones
  FOR UPDATE USING (is_project_member(project_id));

CREATE POLICY "delete milestones" ON milestones
  FOR DELETE USING (is_project_member(project_id));
