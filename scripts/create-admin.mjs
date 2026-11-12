// Creates the first admin user directly in MongoDB, or resets an existing user's password.
// Create: ADMIN_USERNAME=me ADMIN_PASSWORD='long-password' npm run create-admin
// Reset:  ADMIN_USERNAME=me ADMIN_PASSWORD='new-long-password' npm run create-admin -- --reset
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

try { process.loadEnvFile(".env.local"); } catch { /* env may come from the shell instead */ }

const reset = process.argv.includes("--reset");
const { MONGODB_URI, ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;

if (!MONGODB_URI) { console.error("MONGODB_URI is not set (put it in .env.local)."); process.exit(1); }
if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
  console.error("Set ADMIN_USERNAME and ADMIN_PASSWORD, e.g.\n  ADMIN_USERNAME=me ADMIN_PASSWORD='...' npm run create-admin");
  process.exit(1);
}
if (ADMIN_PASSWORD.length < 8) { console.error("Password must be at least 8 characters."); process.exit(1); }

await mongoose.connect(MONGODB_URI);
const users = mongoose.connection.collection("users");

const existing = await users.findOne({ username: ADMIN_USERNAME });

if (reset) {
  if (!existing) {
    console.error(`User "${ADMIN_USERNAME}" does not exist. Run without --reset to create it.`);
    await mongoose.disconnect();
    process.exit(1);
  }
  await users.updateOne(
    { _id: existing._id },
    { $set: { password: await bcrypt.hash(ADMIN_PASSWORD, 10) } }
  );
  console.log(`Password for "${ADMIN_USERNAME}" (role: ${existing.role}) was reset. Role and API keys are unchanged.`);
  await mongoose.disconnect();
  process.exit(0);
}

if (existing) {
  console.error(`User "${ADMIN_USERNAME}" already exists. Nothing changed. Use --reset to change its password.`);
  await mongoose.disconnect();
  process.exit(1);
}

await users.insertOne({
  username: ADMIN_USERNAME,
  password: await bcrypt.hash(ADMIN_PASSWORD, 10),
  role: "admin",
  credits: 99999,
  apiConfig: { groqKey: "", azureKey: "", azureRegion: "eastus" },
  createdAt: new Date(),
});
console.log(`Admin "${ADMIN_USERNAME}" created. Log in, then add your Groq and Azure keys in the settings panel.`);
await mongoose.disconnect();
