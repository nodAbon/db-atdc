CREATE TABLE IF NOT EXISTS public.db_late_reason_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  work_date DATE NOT NULL,
  emp_no TEXT,
  employee_name TEXT NOT NULL,
  check_in TIME NOT NULL,
  schedule_time TIME NOT NULL,
  leader_user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_reason', 'completed', 'expired')),
  reason TEXT,
  responded_by TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_late_reason_requests_pending
  ON public.db_late_reason_requests (leader_user_id, status, updated_at DESC);

ALTER TABLE public.db_late_reason_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.db_late_reason_requests FROM anon, authenticated;
