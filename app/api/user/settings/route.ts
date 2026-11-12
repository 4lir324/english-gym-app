import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  await connectDB();

  // 1. اطلاعات کاربر فعلی را بگیر
  const currentUser = await User.findById((session.user as any).id);
  if (!currentUser) return NextResponse.json({ message: "User not found" }, { status: 404 });

  // فقط ادمین کلیدهای خودش را برای ویرایش می‌گیرد.
  // کاربر عادی هیچ کلیدی دریافت نمی‌کند؛ کلیدهای ادمین فقط سمت سرور (/api/groq و /api/azure/token) استفاده می‌شوند.
  const configToReturn = currentUser.role === 'admin' ? currentUser.apiConfig : {};

  // 3. نقش کاربر را هم برمی‌گردانیم تا فرانت‌اند بداند چه شکلی نشان دهد
  return NextResponse.json({
    apiConfig: configToReturn || {},
    role: currentUser.role
  });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid body" }, { status: 400 });
  }
  await connectDB();

  // فقط سه فیلد مجاز و فقط از نوع string پذیرفته می‌شود (هر چیز دیگری نادیده گرفته می‌شود)
  const str = (v: unknown, fallback = "") =>
    typeof v === "string" ? v.trim().slice(0, 200) : fallback;
  const apiConfig = {
    groqKey: str(body.groqKey),
    azureKey: str(body.azureKey),
    azureRegion: str(body.azureRegion, "eastus") || "eastus",
  };

  // فقط کاربر خودش را آپدیت می‌کند (ادمین کلیدهای خودش را که همان کلیدهای اصلی است آپدیت می‌کند)
  await User.findByIdAndUpdate((session.user as any).id, { apiConfig });

  return NextResponse.json({ message: "Settings saved" });
}