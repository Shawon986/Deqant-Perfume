# DEQANT implementation and deployment status

## Current application architecture

- React 19 + Vite storefront, React Router and tRPC client.
- Hono API with tRPC procedures and Drizzle ORM.
- Firebase Authentication is the identity provider: email/password, email verification, password reset, and Google popup sign-in.
- The Hono API verifies Firebase ID tokens against Google's public signing keys, validates issuer/audience/subject and requires verified email before accepting an authenticated request.
- The existing `users` table continues to hold the API's user and admin role mapping. The initial owner is promoted only when the verified Firebase UID matches server-only `OWNER_FIREBASE_UID`.
- Supabase is configured as a Firebase third-party JWT consumer. The `customer_profiles` table has RLS policies restricting profile access to the Firebase UID in the verified JWT.
- The commerce API uses MySQL-compatible Drizzle tables. The free deployment target is TiDB Cloud Starter with TLS; products, variants, carts, inventory, orders, email logs and admin data remain in this database.
- The platform-specific image-storage adapter has been replaced by Supabase Storage using a server-only Supabase secret key and a private bucket. Supabase still hosts customer profiles through Firebase third-party JWT integration.

## Security and setup work added

- Removed Kimi OAuth callback, Kimi session-cookie authentication and Kimi auth source files.
- Added Firebase client initialization and Firebase ID-token bearer authentication for tRPC requests.
- Added Supabase client configuration that passes the current Firebase ID token using Supabase's supported `accessToken` callback.
- Added an additive Supabase migration for `customer_profiles` with row-level security and self-only select/insert/update policies. The migration was applied to project `jpgithrcohbmjwdnyjsb`.
- Added Firebase Cloud Function source to assign `role=authenticated` to new users, plus a one-time script for existing users. This claim is needed for Supabase's `authenticated` database role; it is not a DEQANT admin claim.
- Added verified-email enforcement in the API and email verification during email/password registration.
- Admin promotion remains server-side and requires the owner's Firebase UID in `OWNER_FIREBASE_UID`.

## Remaining pre-deploy requirements

1. Firebase Email/Password and Google providers are enabled, and Supabase Third-Party Auth is configured for Firebase project `deqant-b30fd` (completed by the user). Add the final Render hostname to Firebase Authentication → Authorized domains after deployment.
2. Deploy `firebase/functions` with Firebase CLI (Cloud Functions deployment may require the Firebase project to be on the Blaze plan). Run `set-existing-user-claims.js` once for existing accounts so they receive the Supabase `role=authenticated` claim.
3. Set `OWNER_FIREBASE_UID` to the owner's Firebase UID in Render. Do not use an email address or a client-side role flag.
4. Create a TiDB Cloud Starter cluster and set `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE`, and `TIDB_ENABLE_SSL=true`.
5. Create a private Supabase Storage bucket named `deqant-products` and set the server-only `SUPABASE_SECRET_KEY`.
6. Configure Resend email if needed, production origins, HTTPS, backups, monitoring and distributed rate limits.
7. Synchronize dependencies with `npm install`, then run `npm run check`, `npm test`, `npm run lint`, and `npm run build` in a complete Node 20+ environment. Test real customer checkout and owner uploads before accepting orders.

## Verification status

- Supabase project `jpgithrcohbmjwdnyjsb` was confirmed active in region `eu-west-1`.
- The `customer_profiles` migration was applied successfully; the project initially had no public tables or migrations.
- Security advisor returned no findings before the profile migration. Re-run security/performance advisors after all auth setup and data migrations.
- Deployment blueprint added for a Render free Node service. Render free services sleep after 15 minutes idle and are intended for preview/hobby use, not reliable production commerce.
- TiDB Cloud Starter is the selected free MySQL-compatible database. Public endpoints require TLS.
- A Render Blueprint (`render.yaml`) and `/health` endpoint are included. Firebase provider settings, Cloud Functions deployment, TiDB provisioning, Supabase Storage bucket/secret, checkout and uploads have not been end-to-end tested.
- TypeScript syntax was checked across 110 `.ts`/`.tsx` files with zero syntax errors; `render.yaml`, package manifests and Firebase function JavaScript passed syntax/format parsing.
- A full TypeScript type-check, unit-test run and production build remain unverified because npm registry access timed out and removed the local dependency contents. The lockfile needs synchronization with the Firebase/Supabase dependencies via `npm install`.
