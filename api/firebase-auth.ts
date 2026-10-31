import * as jose from "jose";
import { env } from "./lib/env";
import { findUserByUnionId, upsertUser } from "./queries/users";

const firebaseJwks = jose.createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export async function authenticateRequest(headers: Headers) {
  const authorization = headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || !env.firebaseProjectId) return undefined;

  const { payload } = await jose.jwtVerify(match[1], firebaseJwks, {
    issuer: `https://securetoken.google.com/${env.firebaseProjectId}`,
    audience: env.firebaseProjectId,
    algorithms: ["RS256"],
  });
  const uid = typeof payload.sub === "string" ? payload.sub : "";
  if (!uid || uid.length > 128) return undefined;

  if (payload.email_verified !== true) return undefined;

  const email = typeof payload.email === "string" ? payload.email : null;
  const name = typeof payload.name === "string" ? payload.name : email?.split("@")[0] ?? "DEQANT customer";
  const avatar = typeof payload.picture === "string" ? payload.picture : null;
  await upsertUser({ unionId: uid, email, name, avatar, lastSignInAt: new Date() });
  return findUserByUnionId(uid);
}
