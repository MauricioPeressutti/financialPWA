"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getClientApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

export function getClientAuth(): Auth {
  if (!_auth) _auth = getAuth(getClientApp());
  return _auth;
}

/** El popup no funciona en una PWA instalada / navegador embebido. */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const googleProvider = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
};

/** Popup (desktop). Devuelve el ID token. */
export async function signInWithGooglePopup(): Promise<string> {
  const cred = await signInWithPopup(
    getClientAuth(),
    googleProvider(),
    browserPopupRedirectResolver,
  );
  return cred.user.getIdToken();
}

/** Redirect (PWA / mobile). La página navega a Google y vuelve. */
export async function signInWithGoogleRedirect(): Promise<void> {
  await signInWithRedirect(getClientAuth(), googleProvider());
}

/** Al volver del redirect: devuelve el ID token si hay un login pendiente. */
export async function completeGoogleRedirect(): Promise<string | null> {
  const result = await getRedirectResult(getClientAuth());
  if (!result) return null;
  return result.user.getIdToken();
}

export async function signOutClient(): Promise<void> {
  await fbSignOut(getClientAuth());
}
