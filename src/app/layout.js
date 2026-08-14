import "./globals.css";
import SessionGuard from '@/components/SessionGuard';

export const metadata = {
  title: "드림베이 근태관리시스템",
  description: "실시간 출퇴근, 월간 근태, 출입기록 및 캘린더 관리 시스템",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" data-theme="light">
      <head>
        <title>드림베이 근태관리시스템</title>
      </head>
      <body>
        <SessionGuard>{children}</SessionGuard>
      </body>
    </html>
  );
}
