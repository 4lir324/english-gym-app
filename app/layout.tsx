import type { Metadata, Viewport } from "next";
import "./globals.css";
import { NextAuthProvider } from "./providers";

export const metadata: Metadata = {
  title: "AI English Gym",
  description: "Learn English with AI",
  manifest: "/manifest.json", // اگر فایل manifest دارید
  // 👇 تنظیمات دقیق آیفون
  appleWebApp: {
    capable: true,
    title: "English Gym",
    statusBarStyle: "black-translucent", // ⭐️ کلید ماجرا: این باعث می‌شود هدر شفاف شود
  },
  icons: {
    icon: "/brain.png",
    apple: "/brain.png",
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // 👇 این خط حیاتی است! باعث می‌شود رنگ پس‌زمینه کل صفحه را بگیرد (حتی زیر ناچ و ساعت)
  viewportFit: "cover",
  themeColor: "#0f172a", // رنگ استاتوس بار در حالت مرورگر معمولی
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </head>
      {/* 👇 استایل‌ها را به بادی می‌دهیم تا مطمئن شویم کل صفحه رنگی است */}
      <body className="antialiased" style={{
          backgroundColor: '#0f172a',
          minHeight: '100vh',
          // 👇 این پدینگ خیلی مهم است!
          // چون هدر شفاف می‌شود، اگر این را نگذارید، دکمه‌های بالا می‌روند زیر ساعت گوشی!
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}>
        <NextAuthProvider>
          {children}
        </NextAuthProvider>
      </body>
    </html>
  );
}