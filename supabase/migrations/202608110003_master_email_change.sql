BEGIN;

UPDATE public.db_profiles AS profile
SET is_admin = TRUE,
    is_global_admin = TRUE,
    dept = COALESCE(profile.dept, '시스템 관리'),
    position = COALESCE(profile.position, '시스템 관리자'),
    updated_at = NOW()
FROM auth.users AS auth_user
WHERE profile.id = auth_user.id
  AND LOWER(auth_user.email) = LOWER('hqadmin@hecto.co.kr');

COMMIT;
