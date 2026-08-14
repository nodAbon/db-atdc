-- ================================================================
-- db-atdc 근태관리 시스템 - Supabase 스키마
-- 테이블 prefix: db_ (소문자, 신규 법인 1700 전용)
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 동기화 및 마스터 테이블
-- ----------------------------------------------------------------

-- db_employees: 신규 법인(1700) 임직원 마스터
CREATE TABLE IF NOT EXISTS db_employees (
  emp_no       VARCHAR(20) PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  dept         VARCHAR(100),
  email        TEXT,
  login_id     TEXT,
  company_code VARCHAR(10) DEFAULT '1700',
  is_active    BOOLEAN DEFAULT TRUE,
  synced_at    TIMESTAMPTZ DEFAULT NOW()
);

-- db_attendance: CAPS 출입기록
CREATE TABLE IF NOT EXISTS db_attendance (
  id         BIGSERIAL PRIMARY KEY,
  sabun      VARCHAR(50),
  emp_no     VARCHAR(20),
  card_no    VARCHAR(20),
  a_time     VARCHAR(14) NOT NULL,     -- YYYYMMDDHHMMSS
  log_time   TIMESTAMPTZ,              -- 파싱된 시간
  eq_code    VARCHAR(10),
  gate_name  VARCHAR(100),
  flag1      VARCHAR(4),
  event_type VARCHAR(10),              -- 출근/퇴근/출입
  source     VARCHAR(20) DEFAULT 'caps',
  synced_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sabun, a_time)
);

-- db_leaves: 연차/휴가 내역
CREATE TABLE IF NOT EXISTS db_leaves (
  id          BIGSERIAL PRIMARY KEY,
  emp_no      VARCHAR(20) NOT NULL,
  emp_name    VARCHAR(100),
  start_date  VARCHAR(8) NOT NULL,     -- YYYYMMDD
  end_date    VARCHAR(8) NOT NULL,
  leave_code  VARCHAR(10),
  leave_name  VARCHAR(100),
  leave_days  DECIMAL(5,3),
  status      VARCHAR(5),
  synced_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (emp_no, start_date, leave_code)
);

-- ----------------------------------------------------------------
-- 2. 계정 및 권한
-- ----------------------------------------------------------------

-- db_profiles: Supabase Auth ↔ 직원 연결 및 권한
CREATE TABLE IF NOT EXISTS db_profiles (
  id                   UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  emp_no               VARCHAR(20) REFERENCES db_employees(emp_no),
  dept                 VARCHAR(100),
  rank                 VARCHAR(50),  -- 직급
  position             VARCHAR(50),  -- 직책 (예: 팀장 등)
  is_admin             BOOLEAN DEFAULT FALSE,
  is_global_admin      BOOLEAN NOT NULL DEFAULT FALSE,
  must_change_password BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- The API upserts profiles by employee number as well as Auth user id.
CREATE UNIQUE INDEX IF NOT EXISTS uq_db_profiles_emp_no ON db_profiles (emp_no);

-- ----------------------------------------------------------------
-- 3. 근무 기준 및 일정 조정
-- ----------------------------------------------------------------

-- db_employee_schedules: 직원별 기본 근무 기준 시간
CREATE TABLE IF NOT EXISTS db_employee_schedules (
  emp_no            VARCHAR(20) PRIMARY KEY REFERENCES db_employees(emp_no) ON DELETE CASCADE,
  schedule_time     TIME NOT NULL DEFAULT '09:00:00',
  schedule_end_time TIME DEFAULT '18:00:00',
  schedule_reason   TEXT,
  updated_by        UUID REFERENCES auth.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- db_schedule_overrides: 특정 날짜별 일정 조정
CREATE TABLE IF NOT EXISTS db_schedule_overrides (
  id             BIGSERIAL PRIMARY KEY,
  emp_no         VARCHAR(20) NOT NULL,
  work_date      DATE NOT NULL,
  schedule_start TIME,
  schedule_end   TIME,
  allow_overtime BOOLEAN NOT NULL DEFAULT TRUE,
  note           TEXT,
  created_by     UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (emp_no, work_date)
);

-- ----------------------------------------------------------------
-- 4. 출입기록 수동 조정 및 보정
-- ----------------------------------------------------------------

-- db_attendance_corrections: 관리자/팀장 수동 출근/퇴근 보정
CREATE TABLE IF NOT EXISTS db_attendance_corrections (
  id                 BIGSERIAL PRIMARY KEY,
  emp_no             VARCHAR(20) NOT NULL,
  work_date          DATE NOT NULL,
  corrected_out_time TIMESTAMPTZ NOT NULL,
  reason             TEXT,
  corrected_by       UUID REFERENCES auth.users(id),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (emp_no, work_date)
);

-- db_attendance_log_adjustments: 개별 출입 태그의 역할 변경 (출근, 퇴근, 무시하기)
CREATE TABLE IF NOT EXISTS db_attendance_log_adjustments (
  id             BIGSERIAL PRIMARY KEY,
  attendance_id  BIGINT NOT NULL REFERENCES db_attendance(id) ON DELETE CASCADE,
  emp_no         VARCHAR(20) NOT NULL,
  work_date      DATE NOT NULL,
  adjusted_role  VARCHAR(10) NOT NULL CHECK (adjusted_role IN ('출근', '퇴근', '무시하기')),
  note           TEXT,
  adjusted_by    UUID REFERENCES auth.users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (attendance_id)
);

-- ----------------------------------------------------------------
-- 5. 캘린더 링크 구독 (iCal)
-- ----------------------------------------------------------------

-- db_ical_subscriptions: 부서/개인별 캘린더 피드 구독 토큰 관리
CREATE TABLE IF NOT EXISTS db_ical_subscriptions (
  id          BIGSERIAL PRIMARY KEY,
  token       TEXT NOT NULL UNIQUE,
  label       VARCHAR(200) NOT NULL,
  depts       JSONB NOT NULL DEFAULT '[]'::jsonb,
  scope       VARCHAR(50) NOT NULL DEFAULT 'leave-calendar',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  revoked_at  TIMESTAMPTZ
);

-- ----------------------------------------------------------------
-- 6. Row Level Security (RLS) 및 권한 정책
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS db_late_reason_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  work_date DATE NOT NULL,
  emp_no TEXT,
  employee_name TEXT NOT NULL,
  check_in TIME,
  schedule_time TIME NOT NULL,
  leader_user_id TEXT NOT NULL,
  alert_type TEXT NOT NULL DEFAULT 'late' CHECK (alert_type IN ('late', 'missing', 'test')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'awaiting_reason', 'completed', 'expired')),
  reason TEXT,
  responded_by TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS db_team_bot_recipients (
  dept TEXT PRIMARY KEY,
  leader_user_id TEXT NOT NULL,
  leader_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE db_employees                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_attendance                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_leaves                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_employee_schedules          ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_schedule_overrides          ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_attendance_corrections      ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_attendance_log_adjustments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_ical_subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_late_reason_requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE db_team_bot_recipients         ENABLE ROW LEVEL SECURITY;

-- 헬퍼 함수
CREATE OR REPLACE FUNCTION db_is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.db_profiles WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION db_is_leader()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT position IN ('팀장', '실장') FROM public.db_profiles WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

CREATE OR REPLACE FUNCTION db_my_emp_no()
RETURNS VARCHAR AS $$
  SELECT emp_no FROM public.db_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER SET search_path = '';

-- 정책 정의
CREATE POLICY "db_employees_admin"    ON db_employees FOR ALL    USING (db_is_admin() OR db_is_leader());
CREATE POLICY "db_employees_self"     ON db_employees FOR SELECT USING (emp_no = db_my_emp_no());

CREATE POLICY "db_attendance_admin"   ON db_attendance FOR ALL    USING (db_is_admin() OR db_is_leader());
CREATE POLICY "db_attendance_self"    ON db_attendance FOR SELECT USING (emp_no = db_my_emp_no());

CREATE POLICY "db_leaves_admin"       ON db_leaves FOR ALL    USING (db_is_admin() OR db_is_leader());
CREATE POLICY "db_leaves_self"        ON db_leaves FOR SELECT USING (emp_no = db_my_emp_no());

CREATE POLICY "db_profiles_admin"     ON db_profiles FOR ALL    USING (db_is_admin());
CREATE POLICY "db_profiles_leader"    ON db_profiles FOR SELECT USING (db_is_leader());
CREATE POLICY "db_profiles_self"      ON db_profiles FOR SELECT USING (id = auth.uid());

CREATE POLICY "db_employee_schedules_admin" ON db_employee_schedules FOR ALL    USING (db_is_admin() OR db_is_leader());
CREATE POLICY "db_employee_schedules_self"  ON db_employee_schedules FOR SELECT USING (emp_no = db_my_emp_no());

CREATE POLICY "db_schedule_overrides_admin" ON db_schedule_overrides FOR ALL    USING (db_is_admin() OR db_is_leader());
CREATE POLICY "db_schedule_overrides_self"  ON db_schedule_overrides FOR SELECT USING (emp_no = db_my_emp_no());

CREATE POLICY "db_corrections_admin"  ON db_attendance_corrections FOR ALL    USING (db_is_admin() OR db_is_leader());
CREATE POLICY "db_corrections_self"   ON db_attendance_corrections FOR SELECT USING (emp_no = db_my_emp_no());

CREATE POLICY "db_attendance_log_adjustments_admin" ON db_attendance_log_adjustments FOR ALL USING (db_is_admin() OR db_is_leader());
CREATE POLICY "db_attendance_log_adjustments_self"  ON db_attendance_log_adjustments FOR SELECT USING (emp_no = db_my_emp_no());

CREATE POLICY "db_ical_subscriptions_admin" ON db_ical_subscriptions FOR ALL USING (db_is_admin() OR db_is_leader()) WITH CHECK (db_is_admin() OR db_is_leader());

-- All application access goes through authenticated server routes. Prevent
-- direct use of the public anon key from bypassing those route-level checks.
REVOKE ALL ON TABLE db_employees, db_attendance, db_leaves, db_profiles,
  db_employee_schedules, db_schedule_overrides, db_attendance_corrections,
  db_attendance_log_adjustments, db_ical_subscriptions, db_late_reason_requests,
  db_team_bot_recipients FROM anon, authenticated;

-- ----------------------------------------------------------------
-- 7. 인덱스
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_db_attendance_emp_no   ON db_attendance (emp_no);
CREATE INDEX IF NOT EXISTS idx_db_attendance_log_time ON db_attendance (log_time DESC);
CREATE INDEX IF NOT EXISTS idx_db_attendance_a_time   ON db_attendance (a_time DESC);
CREATE INDEX IF NOT EXISTS idx_db_employees_login_id  ON db_employees (login_id);
CREATE INDEX IF NOT EXISTS idx_db_employees_email     ON db_employees (email);
CREATE INDEX IF NOT EXISTS idx_db_employees_active    ON db_employees (is_active);
CREATE INDEX IF NOT EXISTS idx_db_profiles_emp_no    ON db_profiles (emp_no);
CREATE INDEX IF NOT EXISTS idx_db_schedules_work_date ON db_schedule_overrides (work_date);
CREATE INDEX IF NOT EXISTS idx_db_leaves_emp_no       ON db_leaves (emp_no);
CREATE INDEX IF NOT EXISTS idx_db_leaves_dates        ON db_leaves (start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_db_corrections_emp     ON db_attendance_corrections (emp_no, work_date);
CREATE INDEX IF NOT EXISTS idx_db_adjustments_emp_date ON db_attendance_log_adjustments (emp_no, work_date);
CREATE INDEX IF NOT EXISTS idx_db_adjustments_att_id   ON db_attendance_log_adjustments (attendance_id);
CREATE INDEX IF NOT EXISTS idx_db_ical_token           ON db_ical_subscriptions (token);
CREATE INDEX IF NOT EXISTS idx_db_late_reason_requests_pending ON db_late_reason_requests (leader_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_db_late_reason_requests_dedupe ON db_late_reason_requests (work_date, emp_no, leader_user_id, alert_type);

-- ----------------------------------------------------------------
-- 8. 근태 사유 / 메모 관리 (db_attendance_notes)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS db_attendance_notes (
  id          BIGSERIAL PRIMARY KEY,
  emp_no      VARCHAR(20) NOT NULL REFERENCES db_employees(emp_no) ON DELETE CASCADE,
  work_date   DATE NOT NULL,
  note        TEXT NOT NULL DEFAULT '',
  image_url   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (emp_no, work_date)
);

CREATE INDEX IF NOT EXISTS idx_db_attendance_notes_date ON db_attendance_notes (work_date);
CREATE INDEX IF NOT EXISTS idx_db_attendance_notes_emp  ON db_attendance_notes (emp_no);
