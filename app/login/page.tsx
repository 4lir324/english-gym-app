"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    if (res?.error) {
      setError("Invalid credentials");
      setLoading(false);
    } else {
      router.push("/"); // هدایت به صفحه اصلی بعد از لاگین
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="container-glass max-w-sm w-full">
        <h2 className="mb-6 text-2xl font-bold text-center text-[#ff9f43]">
          Login
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="p-3 rounded bg-white/10 border border-white/20 text-white outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 rounded bg-white/10 border border-white/20 text-white outline-none"
          />

          {error && <div className="text-red-400 text-sm text-center">{error}</div>}

          <button
            type="submit"
            disabled={loading}
            className="p-3 rounded font-bold text-white mt-2 transition-transform active:scale-95"
            style={{ background: "linear-gradient(135deg, #f35422, #fe8235)" }}
          >
            {loading ? "Checking..." : "Enter Gym 🚀"}
          </button>
        </form>
      </div>
    </div>
  );
}