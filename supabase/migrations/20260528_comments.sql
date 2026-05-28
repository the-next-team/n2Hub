-- ───────────────────────────────────────────────────────────
-- 댓글 테이블 생성
-- Supabase SQL Editor에서 실행하세요.
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  target_type varchar(20)  NOT NULL,   -- 'task' | 'file'
  target_id   uuid         NOT NULL,
  body        text         NOT NULL CHECK (char_length(body) > 0),
  author_id   uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name varchar(255) NOT NULL DEFAULT '',
  created_at  timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS comments_target_idx     ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS comments_project_id_idx ON comments(project_id);

-- RLS 활성화
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 프로젝트 멤버면 조회 가능
CREATE POLICY "select comments" ON comments
  FOR SELECT USING (is_project_member(project_id));

-- 프로젝트 멤버이고 본인 ID로만 작성
CREATE POLICY "insert comments" ON comments
  FOR INSERT WITH CHECK (
    is_project_member(project_id)
    AND author_id = auth.uid()
  );

-- 본인 댓글만 삭제
CREATE POLICY "delete own comments" ON comments
  FOR DELETE USING (author_id = auth.uid());
