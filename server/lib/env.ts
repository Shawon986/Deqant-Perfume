import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value && process.env.NODE_ENV === "production") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value ?? "";
}

const isProduction = process.env.NODE_ENV === "production";
const dbHost = required("TIDB_HOST");
const dbUser = required("TIDB_USER");
const dbPassword = required("TIDB_PASSWORD");
const dbName = required("TIDB_DATABASE");

if (isProduction && (!dbHost || !dbUser || !dbName)) {
  throw new Error("Missing required database settings: TIDB_HOST, TIDB_USER and TIDB_DATABASE");
}

export const env = {
  isProduction,
  dbHost,
  dbPort: Number(process.env.TIDB_PORT || 4000),
  dbUser,
  dbPassword,
  dbName,
  dbSsl: process.env.TIDB_ENABLE_SSL !== "false",
  firebaseProjectId: required("FIREBASE_PROJECT_ID"),
  ownerFirebaseUid: process.env.OWNER_FIREBASE_UID ?? "",
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "deqant-products",
};
