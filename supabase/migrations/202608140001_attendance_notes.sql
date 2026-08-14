-- db_attendance_notes migration
CREATE TABLE IF NOT EXISTS db_attendance_notes (
  id BIGSERIAL PRIMARY KEY,
  emp_no VARCHAR(20) NOT NULL REFERENCES db_employees(emp_no) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (emp_no, work_date)
);
CREATE INDEX IF NOT EXISTS idx_db_attendance_notes_date ON db_attendance_notes (work_date);
CREATE INDEX IF NOT EXISTS idx_db_attendance_notes_emp ON db_attendance_notes (emp_no);
