ALTER TABLE public.db_late_reason_requests
  ALTER COLUMN check_in DROP NOT NULL;

ALTER TABLE public.db_late_reason_requests
  ADD COLUMN IF NOT EXISTS alert_type TEXT NOT NULL DEFAULT 'late'
    CHECK (alert_type IN ('late', 'missing', 'test'));

CREATE INDEX IF NOT EXISTS idx_db_late_reason_requests_dedupe
  ON public.db_late_reason_requests (work_date, emp_no, leader_user_id, alert_type);

CREATE TABLE IF NOT EXISTS public.db_team_bot_recipients (
  dept TEXT PRIMARY KEY,
  leader_user_id TEXT NOT NULL,
  leader_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.db_team_bot_recipients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.db_team_bot_recipients FROM anon, authenticated;
