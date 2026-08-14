BEGIN;

DROP POLICY IF EXISTS "db_profiles_self_upd" ON public.db_profiles;

CREATE OR REPLACE FUNCTION public.db_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.db_profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.db_is_leader()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT position IN ('팀장', '실장') FROM public.db_profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

CREATE OR REPLACE FUNCTION public.db_my_emp_no()
RETURNS VARCHAR
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT emp_no FROM public.db_profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON TABLE public.db_employees, public.db_attendance, public.db_leaves,
  public.db_profiles, public.db_employee_schedules, public.db_schedule_overrides,
  public.db_attendance_corrections, public.db_attendance_log_adjustments,
  public.db_ical_subscriptions FROM anon, authenticated;

COMMIT;
