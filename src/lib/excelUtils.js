import * as XLSX from 'xlsx';

export function exportMonthlyReportToExcel(month, employees = [], dailyStats = {}) {
  const headers = ['사번', '이름', '부서', '총 근무일수', '총 근무시간', '지각 횟수', '조퇴 횟수', '연차 사용'];
  
  const rows = employees.map((emp) => {
    const stat = dailyStats[emp.emp_no] || {};
    return [
      emp.emp_no,
      emp.name,
      emp.dept || '-',
      stat.workDays || 0,
      stat.totalWorkHours ? `${stat.totalWorkHours}시간` : '0시간',
      stat.lateCount || 0,
      stat.earlyLeaveCount || 0,
      stat.leaveDays || 0,
    ];
  });

  const wsData = [
    [`[db-atdc] ${month} 월간 근태 보고서`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${month} 근태보고`);

  XLSX.writeFile(wb, `db_atdc_monthly_report_${month}.xlsx`);
}
