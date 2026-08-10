# db-atdc 근태관리 시스템

신규 법인(`1700`) 전용 근태 및 CAPS 출입관리 시스템입니다.

## 주요 메뉴 구성 (4개)
1. **대시보드 (`/` 또는 `/?tab=DASHBOARD`)**: 당일 실시간 출퇴근 현황, 통계 요약, 부서별 필터링
2. **월간 근태보고 (`/?tab=MONTHLY`)**: 월별 근태 집계표, 근무일수/총근무시간/지각/조퇴/연차, 엑셀 다운로드
3. **출입기록 조회 및 조정 (`/attendance-records`)**: CAPS 출입 로그 조회, 출근/퇴근/무시 역할 조정, 수동 시간 보정
4. **캘린더 링크생성 (`/calendar-links`)**: 부서별/전사 iCal 구독 링크 발급, 구글/아웃룩/애플 캘린더 연동

## 기술 스택
- **Framework**: Next.js 16 (App Router), React 19
- **Database**: Supabase (`db_*` 스키마), AWS MySQL (읽기전용 원천 DB)
- **Styling**: Vanilla CSS Design System (Blue Accent Theme)
- **Utilities**: `xlsx` (Excel), `lucide-react` (Icons)

## 개발 서버 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000`으로 접속하여 확인합니다.
