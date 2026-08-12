BEGIN;

CREATE TABLE IF NOT EXISTS public.db_notification_deliveries (
  id BIGSERIAL PRIMARY KEY,
  job_key TEXT NOT NULL UNIQUE,
  job_type TEXT NOT NULL CHECK (job_type IN ('daily-late-mail')),
  work_date DATE NOT NULL,
  recipient_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  late_count INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_db_notification_deliveries_job_key
  ON public.db_notification_deliveries (job_key);
CREATE INDEX IF NOT EXISTS idx_db_notification_deliveries_work_date
  ON public.db_notification_deliveries (work_date DESC);

ALTER TABLE public.db_notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.db_notification_deliveries FROM anon, authenticated;

COMMIT;
