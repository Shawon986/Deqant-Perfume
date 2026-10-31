# DEQANT free deployment preview

This project currently runs as a Node.js/Hono full-stack app. The prepared free-preview architecture is:

- **Render Free Web Service** — runs the Node.js server and serves the Vite-built storefront.
- **TiDB Cloud Starter** — MySQL-compatible commerce database for products, carts, inventory and orders.
- **Supabase** — Firebase-backed customer profiles and private product-image storage.
- **Firebase Authentication** — customer sign-in and server-verified owner access.

Cloudflare can be used later for DNS and a custom domain. Do not choose Cloudflare Pages' static upload flow for this repository: it would publish only the frontend and would not run the current Node/Hono API.

## 1. Create the commerce database

1. Create a free TiDB Cloud Starter cluster using the MySQL-compatible option.
2. Select the public connection and the General connection method.
3. Copy the host, port, username and password from the connection dialog. The public endpoint uses port `4000` and requires TLS.
4. Create an empty database named `deqant` in the TiDB SQL editor:

   ```sql
   CREATE DATABASE deqant;
   ```

5. Keep the database password private. Do not paste it into chat or commit it to GitHub.

TiDB Starter's published free quota is 5 GiB row storage, 5 GiB columnar storage and 50 million request units per month per eligible Starter instance. Monitor usage in the TiDB dashboard.

## 2. Prepare the Supabase image bucket

1. Open the existing Supabase project `jpgithrcohbmjwdnyjsb`.
2. Go to Storage and create a bucket named `deqant-products`.
3. Keep the bucket **private**. Set the upload limit to 8 MB and allow JPEG, PNG and WebP images.
4. Open Project Settings → API Keys and copy a server-side Secret key (`sb_secret_...`) for the backend environment variable `SUPABASE_SECRET_KEY`. A legacy `service_role` key is also accepted by the code.
5. Never put this key in a `VITE_` variable, frontend source, GitHub, or screenshots.

The API uses the secret key only on the server to upload images and issue 10-minute signed URLs. Customer-facing media routes do not expose the secret key.

## 3. Initialize the database schema

On a computer with Node.js 20.12+ and Git:

```bash
npm install
cp .env.example .env
```

Fill in the TiDB values and the Firebase/Supabase values in `.env`, then run:

```bash
npm run db:push
npx tsx db/seed.ts
npm run check
npm test
npm run build
```

Run `db:push` only against the new empty `deqant` database. Review any schema diff; do not approve destructive drops on a database containing live orders or customer data.

## 4. Check Firebase prerequisites

- Email/password and Google providers must be enabled in Firebase Authentication.
- Add the final Render hostname to Firebase Authentication → Settings → Authorized domains after the first deployment.
- Supabase Authentication → Third-Party Auth must list Firebase project ID `deqant-b30fd`.
- Deploy the function in `firebase/functions` so newly registered users receive the `role=authenticated` custom claim required by Supabase. Existing Firebase users need the one-time `set-existing-user-claims.js` script.
- Firebase Cloud Functions deployment may require enabling the Firebase Blaze billing plan. This is separate from the free Render/TiDB hosting quotas.

`OWNER_FIREBASE_UID` must contain the owner's Firebase UID, not their email address. Keep it in the Render environment settings only.

## 5. Push the project to GitHub

Create a private GitHub repository and upload the contents of this project folder. Include `render.yaml`, `.node-version`, `package.json` and the source directories. Do **not** upload:

- `.env` or any `.env.local` file
- `node_modules/`
- `dist/`
- Firebase service-account JSON files or private keys

The package manifest and lockfile were not fully synchronized in this preparation environment because npm registry access timed out. Render's Blueprint build command intentionally runs `npm install` (not `npm ci`) so npm can reconcile the Firebase and Supabase dependencies with `package.json`. For a reproducible local install, run `npm install` and commit the updated `package-lock.json` before deploying.

## 6. Deploy on Render

1. Open Render and choose **New → Blueprint**.
2. Connect the GitHub repository containing `render.yaml`.
3. Review the service named `deqant-store` and choose the Free plan.
4. Fill the values Render requests for variables marked `sync: false`: `OWNER_FIREBASE_UID`, `TIDB_HOST`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE`, `SUPABASE_SECRET_KEY`. Add the Resend variables only if email notifications are being enabled.
5. Create the Blueprint and wait for the build/deploy to finish.
6. Open `https://YOUR-RENDER-HOST/health`. A successful response is JSON with `status: "ok"`.

## 7. Test before accepting orders

Test all of these against the deployed URL:

- customer registration, email verification, sign-in and password reset
- Google sign-in and Firebase authorized domain
- owner sign-in and admin-only dashboard routes
- product image upload and signed image display
- product/variant catalogue, cart persistence and stock checks
- checkout, order success, phone-based tracking and owner order updates
- contact messages and optional email notifications

Do not accept live orders until checkout, inventory transactions, owner access and storage have passed end-to-end testing.

## Free-tier limitations

Render Free web services sleep after 15 minutes without inbound traffic; the next request can take about a minute to wake the app. Free services can restart and have ephemeral local filesystems. The app therefore stores commerce data in TiDB and images in Supabase, not on the Render filesystem.

Render describes its free instances as suitable for hobby projects and previews, not production applications. Treat this deployment as a staging/preview environment. Do not use Render Free Postgres for durable order data: its free databases expire after 30 days.
