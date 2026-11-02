# DEQANT security and release checklist

## Application controls in this branch

- Firebase ID tokens are verified server-side against Google's secure-token JWKS, project issuer and audience, RS256, expiry, and verified-email claim.
- Administrator procedures use server-side database roles; hiding admin links in the browser is not an authorization control.
- Public storefront settings are returned from an explicit allowlist rather than exposing every settings row.
- Public order lookup returns only the fields needed for the confirmation page and is rate-limited.
- Checkout recalculates prices and delivery fees from database records, locks inventory rows in a transaction, checks stock again, and uses an idempotency key.
- Authenticated orders are associated with the server-verified user ID. Customer order history filters by that ID on the server.
- Guest checkout remains available and guest orders remain trackable using the order reference and phone number.
- Image upload validates the actual file signature and size; signed media access is restricted to the product image namespace.
- Request payloads are bounded, user inputs are schema-validated, and API responses are marked no-store.
- Basic HTTP security headers are added by the server.

## Required production controls

1. Configure Vercel Firewall / WAF rate limits for `/api/trpc/*`, especially checkout, order lookup, tracking, contact and cart mutations. The in-process application limiter is only a secondary guard: it is not shared across serverless instances.
2. Keep TiDB credentials and the Supabase Storage secret key in server-only Vercel environment variables. Never prefix them with `VITE_` or commit them to Git.
3. Use a least-privilege TiDB database user, require TLS, and restrict database network access to the application environment where possible.
4. Restrict Firebase authorized domains to the production and required preview domains. Keep the owner Firebase UID configured server-side; never accept a role from browser input.
5. Enable MFA for the owner Google/Firebase account and GitHub/Vercel accounts. Rotate any secret that has ever been committed or shared.
6. Keep production and preview environment variables separate. Do not point untrusted preview deployments at production data.
7. Review Vercel logs and database access logs regularly; alert on repeated 401/403/429 responses and unusual order lookups.

## Database changes required before deployment

Run these SQL migrations against the DEQANT TiDB database in numerical order, before deploying the new application code:

1. `db/migrations/0001_add_customer_order_owner.sql` — associates new signed-in orders with the verified customer account. Existing guest orders remain unchanged.
2. `db/migrations/0002_customer_features_and_coupons.sql` — adds the customer address book, verified product reviews, coupon definitions, and coupon/discount snapshots on orders.

Back up the database first and verify the migration result in a staging database. Existing orders receive a zero discount and no coupon code. Existing customers can save addresses after deployment. Reviews are only accepted from signed-in customers with a delivered order containing that product; new reviews remain pending until an administrator approves them. Coupon usage and discount calculation are performed on the server during COD checkout.

## Payment model

This release intentionally supports cash on delivery only. No online payment gateway, card collection, or payment-provider credentials are required.

## Scope and limitation

No web application can be guaranteed unhackable. These controls provide defense in depth, but the deployment firewall, secret management, database permissions, Firebase configuration, dependency updates, and monitoring must also be maintained. The wishlist in this release is stored in the customer's browser; it is not synced across devices.
