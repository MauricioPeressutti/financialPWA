import "server-only";

import {
  SignJWT,
  jwtVerify,
  importX509,
  decodeProtectedHeader,
} from "jose";

import { SESSION_MAX_AGE_MS } from "@/lib/session";

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/session";

/**
 * Verificación de ID tokens de Firebase sin el Admin SDK.
 * El token es un JWT RS256 firmado por Google; se valida contra las
 * claves públicas de `securetoken@system.gserviceaccount.com`.
 */

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "";
const X509_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

export type FirebaseToken = {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
};

let certCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  if (certCache && Date.now() < certCache.expiresAt) return certCache.certs;

  const res = await fetch(X509_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("No se pudieron obtener las claves de Google");
  const certs = (await res.json()) as Record<string, string>;

  const maxAge =
    Number(res.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1]) || 3600;
  certCache = {
    certs,
    expiresAt: Date.now() + Math.min(maxAge, 21600) * 1000,
  };
  return certs;
}

export async function verifyIdToken(idToken: string): Promise<FirebaseToken> {
  if (!PROJECT_ID) throw new Error("Falta FIREBASE_PROJECT_ID");

  const { kid } = decodeProtectedHeader(idToken);
  if (!kid) throw new Error("Token sin kid");

  const certs = await getGoogleCerts();
  const pem = certs[kid];
  if (!pem) throw new Error("kid desconocido");

  const key = await importX509(pem, "RS256");
  const { payload } = await jwtVerify(idToken, key, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });

  if (!payload.sub) throw new Error("Token sin sub");
  return {
    uid: payload.sub,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
  };
}

// ─── Sesión propia (JWT HS256, sin depender de Google) ────────
function sessionSecret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error("Falta SESSION_SECRET (>= 32 caracteres recomendado)");
  }
  return new TextEncoder().encode(s);
}

export async function createSessionCookie(token: FirebaseToken): Promise<string> {
  return new SignJWT({
    email: token.email,
    name: token.name,
    picture: token.picture,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(token.uid)
    .setIssuedAt()
    .setExpirationTime(Math.floor((Date.now() + SESSION_MAX_AGE_MS) / 1000))
    .sign(sessionSecret());
}

export async function verifySessionCookie(
  cookie: string,
): Promise<{ uid: string; email?: string; name?: string; picture?: string }> {
  const { payload } = await jwtVerify(cookie, sessionSecret());
  return {
    uid: payload.sub as string,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
  };
}
