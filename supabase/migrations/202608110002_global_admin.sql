BEGIN;

ALTER TABLE public.db_profiles
  ADD COLUMN IF NOT EXISTS is_global_admin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.db_profiles AS profile
SET is_global_admin = TRUE,
    is_admin = TRUE,
    dept = COALESCE(profile.dept, '시스템 관리'),
    position = COALESCE(profile.position, '시스템 관리자'),
    updated_at = NOW()
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND LOWER(auth_user.email) = LOWER('bhkim@hecto.co.kr');

COMMIT;
