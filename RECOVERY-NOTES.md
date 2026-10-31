# DEQANT dependency and TypeScript recovery notes

This archive is a source-code recovery update, not a certified production release.

## Important: do not use `npm audit fix --force`

The supplied terminal log shows that `npm audit fix --force` selected major-version changes for `@hono/vite-dev-server`, `firebase`, and `drizzle-kit`. It then left 23 reported vulnerabilities (including one critical) and produced TypeScript errors. Those forced dependency changes should not be treated as a successful security fix.

## Start from this clean source archive

1. Extract this archive into a new, empty folder. Do not merge it into the folder that received the forced audit changes.
2. Confirm `package.json` still declares Firebase `^12.5.0`, `@hono/vite-dev-server` `^0.19.0`, and Drizzle Kit `^0.31.8`.
3. Run `npm install --no-audit --no-fund` to regenerate `package-lock.json` from the declared dependencies. Do not use `npm ci` until the lockfile has been regenerated.
4. Run `npm audit` and review any remaining advisories. Only run plain `npm audit fix` if npm reports compatible fixes. Do not use `--force` without reviewing and testing each major upgrade.
5. Run `npm run check`, `npm test`, and `npm run build`.

## Code change in this update

`api/queries/connection.ts` now returns the database instance directly after lazy initialization. This avoids exposing `undefined` in the return type to all database callers, which accounts for most of the reported TS18048/TS2532 errors in the supplied log.

## Still requiring verification

- The npm registry must be reachable to regenerate the lockfile and install the declared Firebase and Supabase packages.
- The exact local folder modified by `npm audit fix --force` was not uploaded, so this archive intentionally starts from the clean prepared source rather than trying to preserve that altered dependency tree.
- A successful TypeScript check, test run, production build, database connection, Firebase login/admin flow, Supabase storage upload, and checkout test are still required before deployment.

## Follow-up TypeScript fixes (2026-10-31)

Based on the latest `npm run check` output supplied by the project owner:

- Corrected `api/firebase-auth.ts` imports to reference `api/lib/env.ts` and `api/queries/users.ts` from their actual locations.
- Refactored `api/queries/connection.ts` so the cached database type is inferred from the same factory function that constructs the Drizzle connection. This avoids the previous explicit generic `ReturnType<typeof drizzle<...>>` annotation that triggered an incompatible MySQL2 pool type assignment.

Verification limitation: npm registry access timed out while attempting `npm install --package-lock-only --ignore-scripts --no-audit --no-fund` in this environment. Therefore the lockfile has not been regenerated here, and TypeScript/build/tests have not been rerun against installed dependencies. After extracting this archive, run `npm install` (or `npm install --package-lock-only` to refresh the lockfile), then `npm run check` and share any remaining output.
