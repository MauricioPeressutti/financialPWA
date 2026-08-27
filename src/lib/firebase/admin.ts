import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

export { SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "@/lib/session";
import { SESSION_MAX_AGE_MS } from "@/lib/session";

let _auth: Auth | null = null;

function initAdmin(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Faltan credenciales del Admin SDK (FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY)",
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

function adminAuthLazy(): Auth {
  if (!_auth) _auth = getAuth(initAdmin());
  return _auth;
}

export const adminAuth = {
  verifyIdToken: (idToken: string) => adminAuthLazy().verifyIdToken(idToken),
};

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuthLazy().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
}

export async function verifySessionCookie(cookie: string) {
  return adminAuthLazy().verifySessionCookie(cookie, true);
}
