import './globals.css';

export const metadata = {
  title: 'db-atdc 근태관리 시스템',
  description: '신규 법인 전용 근태 및 CAPS 출입관리 시스템',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko" data-theme="dark">
      <body>{children}</body>
    </html>
  );
}
