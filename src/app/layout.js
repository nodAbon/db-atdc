import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata = {
  title: "HECTO 근태관리시스템",
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
    <html lang="ko" data-theme="light" className={`${outfit.variable} ${jetbrainsMono.variable}`}>
      <head>
        <title>HECTO 근태관리시스템</title>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
