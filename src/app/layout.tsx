import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "בצל הקודש",
  description: "מערכת ניהול הבחורים של ישיבות בעלזא",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
