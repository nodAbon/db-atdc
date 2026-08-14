ALTER TABLE public.db_employee_schedules
  ADD COLUMN IF NOT EXISTS schedule_reason TEXT;

COMMENT ON COLUMN public.db_employee_schedules.schedule_reason IS
  '관리자가 직원별 기본 출근시간을 변경한 사유';
