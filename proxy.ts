import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  /*
   * فقط مسیرهای زیر نیاز به لاگین دارند:
   * 1. /admin (پنل مدیریت)
   * 2. /api/admin (کارهای پشت صحنه ادمین)
   * 3. /api/user (تنظیمات کاربر)
   * بقیه مسیرها (مثل صفحه اصلی /) برای همه باز هستند.
   */
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/user/:path*",
    "/api/groq",
    "/api/azure/:path*"
  ],
};