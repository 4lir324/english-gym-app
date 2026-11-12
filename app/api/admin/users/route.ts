import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";
import bcrypt from "bcryptjs";

// تابع کمکی برای چک کردن دسترسی ادمین
async function isAdmin() {
  const session = await getServerSession(authOptions);
  // @ts-ignore
  return session?.user?.role === 'admin';
}

// لیست کردن کاربران (GET)
export async function GET() {
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  await connectDB();
  const users = await User.find({}, 'username role createdAt credits').sort({ createdAt: -1 });
  return NextResponse.json(users);
}

// ساخت کاربر جدید (POST)
export async function POST(req: Request) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { username, password, role } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: "Username and password required" }, { status: 400 });
    }

    await connectDB();

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return NextResponse.json({ error: "Username already taken" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      password: hashedPassword,
      role: role || 'user',
      credits: 100
    });

    return NextResponse.json({ message: "User created successfully", user: newUser });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 👇 متد جدید برای حذف کاربر (DELETE)
export async function DELETE(req: Request) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    // گرفتن ID از آدرس (مثلا ?id=123...)
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    await connectDB();
    await User.findByIdAndDelete(id);

    return NextResponse.json({ message: "User deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}