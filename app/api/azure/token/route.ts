import { NextResponse } from "next/server";
import { getKeysForSession } from "@/lib/apiKeys";

// Azure speech tokens live for 10 minutes; cache for 8 so we don't call Azure on every click.
let cache: { key: string; token: string; expires: number } | null = null;

export async function POST() {
  const keys = await getKeysForSession();
  if (!keys) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!keys.azureKey) return NextResponse.json({ error: "Azure key is not configured by the admin" }, { status: 503 });

  const region = keys.azureRegion.trim().toLowerCase().replace(/\s+/g, "");
  const cacheKey = `${region}:${keys.azureKey}`;
  if (cache && cache.key === cacheKey && cache.expires > Date.now()) {
    return NextResponse.json({ token: cache.token, region });
  }

  const res = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: "POST",
    headers: { "Ocp-Apim-Subscription-Key": keys.azureKey.trim(), "Content-Length": "0" },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `Azure rejected the key/region (HTTP ${res.status}). Admin: check Azure key and region.` },
      { status: 502 }
    );
  }
  const token = await res.text();
  cache = { key: cacheKey, token, expires: Date.now() + 8 * 60 * 1000 };
  return NextResponse.json({ token, region });
}
