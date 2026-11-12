import { NextResponse } from "next/server";
import { getKeysForSession } from "@/lib/apiKeys";

// Only these models can be requested through the proxy (keeps the shared key from being used for anything else)
const ALLOWED_MODELS = new Set([
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.8-27b",
]);

export async function POST(req: Request) {
  const keys = await getKeysForSession();
  if (!keys) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!keys.groqKey) return NextResponse.json({ error: "Groq key is not configured by the admin" }, { status: 503 });

  const body = await req.json().catch(() => null);
  const { model, system, user, temperature } = body || {};
  if (!ALLOWED_MODELS.has(model) || typeof user !== "string" || typeof system !== "string") {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (user.length > 2000 || system.length > 2000) {
    return NextResponse.json({ error: "Request too long" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: typeof temperature === "number" ? Math.min(Math.max(temperature, 0), 2) : 1,
    max_tokens: 1024,
  };
  if (model.startsWith("openai/gpt-oss")) payload.reasoning_effort = "low";

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${keys.groqKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({ error: { message: "Bad response from Groq" } }));
  return NextResponse.json(data, { status: res.status });
}
