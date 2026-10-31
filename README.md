# DEQANT Fragrance

A full-stack luxury fragrance storefront for decants and intact bottles, with a database-backed guest cart, cash-on-delivery checkout, order tracking, and a role-protected owner dashboard.

## Stack

- React 19, TypeScript, Vite, React Router, Tailwind CSS, and TanStack Query
- Hono and tRPC 11 with SuperJSON
- Drizzle ORM with a MySQL-compatible commerce database (TiDB Cloud Starter recommended for the free setup)
- Firebase Authentication (email/password, email verification, password reset, Google sign-in) with server-verified Firebase ID tokens and role-based admin procedures
- Supabase third-party Firebase JWT integration for customer profiles with row-level security
- Server-mediated Supabase Storage adapter for owner-uploaded product images (private bucket and signed media URLs)
- Resend's REST API for optional branded order email

The commerce API uses a MySQL-compatible database. The recommended free deployment uses TiDB Cloud Starter with TLS; Supabase remains responsible for Firebase-backed customer profiles and private product-image storage.

## Storefront and owner features

- Home, complete catalogue, decants, intact bottles, best sellers, offers, product details, cart, checkout, order success, tracking, about, contact, privacy, terms, and delivery/returns
- Database-managed products, variants, BDT prices, discounts, stock, merchandising flags, delivery zones, and website copy
- Search, category/size/price/discount/best-seller filters, and featured/price/popularity/newest sorting
- Decant variants from 3–30 ml and intact variants from 60–150 ml, according to each product's database rows
- Anonymous UUID cart tokens; cart contents persist in the database rather than only in the browser
- Server-side variant, price, stock, zone, and order-total validation
- Unique order numbers, idempotency keys, transactional inventory updates, row locking, and historical order-item price snapshots
- Public tracking that requires both order number and matching phone number
- Owner overview, orders, internal notes, status updates, products, variants, inventory, image uploads, delivery zones, website content, messages, and email status/retry controls
- Responsive layouts, reduced-motion support, keyboard focus states, SEO metadata, Product JSON-LD, dynamic sitemap, and robots directives

## Project map

```text
api/                 Hono server, tRPC routers, auth, email, media and storage
contracts/           Shared constants and types
db/schema.ts         Relational database schema
db/seed.ts           Initial catalogue, delivery zones and website copy
public/brand/        Converted official DEQANT artwork
public/products/     Original DEQANT product compositions
public/fonts/        Locally hosted typefaces
scripts/load-test.mjs Read-only load-test utility
src/pages/           Storefront and owner pages
src/providers/       tRPC and database-cart client providers
brand-assets/        Original supplied PDF and EPS artwork
```

## Running locally

Use Node.js 20.12 or newer.

```bash
cp .env.example .env       # then supply local MySQL/TiDB and Firebase/Supabase values
npm install
npm run db:push
npx tsx db/seed.ts
npm run dev
```

The development server listens on `http://localhost:3000` by default. Copy the Firebase and Supabase public settings from `.env.example`; provide your TiDB/MySQL host, credentials, and owner Firebase UID. Never put service-account private keys or Supabase secret/service-role keys in frontend environment variables.

Always review `db:push` prompts carefully. Never approve table truncation on a populated database merely to bypass a schema warning.

### Production

```bash
npm run check
npm test
npm run build
npm start
```

The production server serves `dist/public` and the API from the same Hono process. `PORT` is supplied by the hosting platform.

### Free deployment preview (Render + TiDB + Supabase)

This repository includes a `render.yaml` Blueprint for a free Node.js web service. The app is a Node/Hono server, so it should not be deployed as a Cloudflare Pages static-only site or as a Workers bundle without a separate runtime/database migration.

1. Create a free TiDB Cloud Starter MySQL-compatible cluster. Copy its public endpoint host, username, password and database name. Enable TLS; TiDB Cloud Starter public endpoints require it.
2. In TiDB, create an empty database named `deqant` (or use the name you configured).
3. Locally, set the `TIDB_*` values in `.env`, then run `npm run db:push` and `npx tsx db/seed.ts`. Review the schema diff carefully; never accept a destructive table drop on a populated database.
4. In Supabase Storage, create a **private** bucket named `deqant-products`. Copy the project's server-only secret key for `SUPABASE_SECRET_KEY`; never put this key in a `VITE_` variable or commit it.
5. Push this repository to GitHub, then create a Render Blueprint from the repository and choose the Free plan. Enter the TiDB credentials, owner Firebase UID, and Supabase secret when Render asks for values marked `sync: false`.
6. After the first deployment, open `/health` on the Render service URL. Test registration, email verification, Google sign-in, owner access, product image upload, cart persistence, stock validation, checkout, order tracking and order status changes before accepting real orders.

The Render Free web service sleeps after 15 minutes without traffic and can take about a minute to wake. Treat this as a preview/testing deployment, not reliable production hosting. TiDB Cloud Starter has monthly free quotas; monitor usage in its dashboard. Do not create a Render Free Postgres database for durable commerce data: Render's free Postgres databases expire after 30 days.


### Database seeding

`npx tsx db/seed.ts` inserts the starter catalogue only when no products exist, and starter delivery zones only when no zones exist. Website settings are upserted. Do not use seeding as a reset mechanism; it does not clear orders or customer data.

## Environment configuration

See `.env.example` for the complete template. Values are server-side unless prefixed with `VITE_`. Run `npm install` after checkout so the lockfile is synchronized with the Firebase and Supabase dependencies before building.

### Firebase, Supabase Storage and TiDB

- `FIREBASE_PROJECT_ID` and the `VITE_FIREBASE_*` values configure Firebase Authentication. The browser values are public Firebase Web App configuration; do not put Firebase service-account credentials in the browser.
- `OWNER_FIREBASE_UID` is the initial owner's Firebase UID. Admin rights are assigned by the server after verifying the Firebase ID token; never use a client-side role flag.
- `TIDB_HOST`, `TIDB_PORT`, `TIDB_USER`, `TIDB_PASSWORD`, `TIDB_DATABASE`, and `TIDB_ENABLE_SSL` configure the MySQL-compatible commerce database. TiDB Cloud Starter public connections require TLS. For local MySQL, set its host/port and `TIDB_ENABLE_SSL=false`.
- `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are server-side storage settings. `SUPABASE_SECRET_KEY` must remain private and must never use a `VITE_` prefix. Create a **private** Supabase Storage bucket named `deqant-products` (or change `SUPABASE_STORAGE_BUCKET`). The backend uploads files and creates short-lived signed URLs.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` are public client settings. Supabase third-party Firebase JWT integration must be configured for Firebase project `deqant-b30fd`.
- Deploy `firebase/functions` so new Firebase users receive the `role=authenticated` claim required by Supabase, then run `set-existing-user-claims.js` once for existing users. Firebase Functions deployment may require the Firebase project to use the Blaze billing plan.

Never expose a Supabase secret/service-role key or Firebase service-account private key in frontend code or version control.

### Resend email

Email is optional and order persistence never depends on it. Configure all applicable values:

```dotenv
RESEND_API_KEY=re_...
OWNER_EMAIL=owner@example.com
RESEND_FROM_EMAIL=DEQANT <orders@your-verified-domain.com>
```

- `RESEND_API_KEY`: Resend API secret.
- `OWNER_EMAIL`: destination for new-order owner notifications.
- `RESEND_FROM_EMAIL`: a sender on a domain verified in Resend; omit it to use the code's development fallback.
- The customer receives email only when checkout supplied a valid optional email address.

Email states appear in the owner dashboard: `pending`, `sent`, `failed`, and `not_configured`. Failed or unconfigured notifications can be retried after configuration. Checkout still succeeds if email fails.

## Product image storage

Owner uploads accept JPEG, PNG, or WebP up to 8 MB and pass through the authenticated backend. The database stores object keys, never expiring signed URLs. Public media responses mint a short-lived signed URL and redirect to it.

Uploads, stored bytes, publishing, runtime, and API calls can consume the owner's platform quota. Do not describe these services as free. Review actual usage under the platform's quota and invoice settings.

## Order and security model

- Checkout calculates totals from current database prices and the selected active delivery zone.
- A transaction locks each purchased variant, rechecks stock, decrements inventory, writes the order and its item snapshots, and clears purchased cart lines.
- The unique idempotency key prevents duplicate submissions from creating another order.
- Order success and tracking require matching phone verification; public tracking omits address and other private customer fields.
- Admin APIs require an authenticated admin. Upload and zone-creation endpoints are protected by the same middleware.
- Drizzle parameterizes database operations, Zod validates inputs, React escapes rendered content, and Firebase ID tokens are verified server-side.
- Cart, checkout, contact, and tracking routes have per-IP in-memory rate limits. These limits are per server process, not a distributed rate-limit service.

## Verification

```bash
npm run check
npm run build
npm test
node scripts/load-test.mjs
```

Before publishing, also verify the actual customer flow in Chromium: variant selection, cart reload persistence, delivery-zone pricing, checkout, success, tracking, owner order status, and email state. Test object storage through an authenticated owner upload when provisioning is available.

## Load testing

The included utility performs read-only GET requests and never creates carts, messages, or orders. Run it against an environment you are authorized to test:

```bash
LOAD_TEST_URL=http://localhost:3000 \
LOAD_TEST_CONCURRENCY=10 \
LOAD_TEST_DURATION=15 \
node scripts/load-test.mjs
```

Optional `LOAD_TEST_PATHS` accepts a comma-separated list. Defaults cover the home page, shop, catalogue API, product page, and sitemap. Results include throughput, status counts, and observed latency percentiles.

No 100-, 250-, 500-, or 1,000-concurrent-user capacity is certified by this project. Capacity depends on the deployed runtime and database. Run staged tests in the production-like environment, monitor database connections and resource limits, and report only measured outcomes.

## Publishing checklist

1. Supply production Resend values if email is required, and verify the sender domain.
2. Replace starter contact details and review all policy copy with the business owner.
3. Review starter products, prices, stock, delivery zones, and legal text in the owner dashboard.
4. Keep the original DEQANT artwork unchanged; see `CREDITS.md`.
5. Run type checks, a production build, browser journeys, and staged load tests.
6. Deploy through your selected hosting provider after completing the deployment checklist in `IMPLEMENTATION_NOTES.md`.

## Current operational notes

- Checkout is cash on delivery only; no third-party payment integration is implied.
- External email remains `not_configured` until valid Resend settings are supplied.
- Local bundled product compositions are original storefront illustrations using the supplied official wordmark. Owner-uploaded photography can replace them through the dashboard.
- No load-test result should be represented as a concurrency guarantee.
