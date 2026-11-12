import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import connectDB from "@/lib/db";
import User from "@/models/User";

export type ApiKeys = { groqKey: string; azureKey: string; azureRegion: string };

/**
 * Returns the API keys the current logged-in user is allowed to use on the server:
 * an admin uses their own keys, everybody else uses the first admin's keys.
 * The keys never leave the server. Returns null when there is no session.
 */
export async function getKeysForSession(): Promise<ApiKeys | null> {
  const session = await getServerSession(authOptions);
  const id = (session?.user as any)?.id;
  if (!id) return null;

  await connectDB();
  const me = await User.findById(id);
  if (!me) return null;

  const source = me.role === "admin" ? me : await User.findOne({ role: "admin" });
  const cfg = source?.apiConfig;
  return {
    groqKey: cfg?.groqKey || "",
    azureKey: cfg?.azureKey || "",
    azureRegion: cfg?.azureRegion || "eastus",
  };
}
