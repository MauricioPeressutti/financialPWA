"use client";

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  type Auth,
  type User,
} from "firebase/auth";

/**
 * En local usamos el authDomain de Firebase (`*.firebaseapp.com`), que ya está
 * autorizado. En prod/preview usamos el dominio propio de la app: así el flujo
 * de `signInWithRedirect` queda same-origin (vía el rewrite `/__/auth/*` de
 * next.config.ts) y no lo rompe el particionado de storage de los browsers
 * mobile (Safari/Chrome), que era lo que dejaba el login colgado.
 */
function resolveAuthDomain(): string | undefined {
  const env = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  if (typeof window === "undefined") return env;
  const h = window.location.hostname;
  const isLocal =
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".local") ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h);
  return isLocal ? env : window.location.host;
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: resolveAuthDomain(),
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

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * El popup de Google no funciona confiablemente en móviles (Safari/Chrome
 * mobile lo bloquean o lo abren en otra pestaña) ni en PWAs instaladas.
 * Ahí usamos redirect; el popup queda sólo para desktop.
 */
export function shouldUseRedirect(): boolean {
  if (typeof window === "undefined") return true;
  if (isStandalone()) return true;
  const coarsePointer = window.matchMedia?.("(pointer: coarse)").matches;
  const smallScreen = window.innerWidth < 820;
  return Boolean(coarsePointer || smallScreen);
}

const googleProvider = () => new GoogleAuthProvider();

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

/**
 * Al volver del redirect: devuelve el ID token si hay un login pendiente.
 * Memoizado — `getRedirectResult` consume el evento pendiente, así que hay que
 * pedirlo una sola vez (si no, con StrictMode en dev la 2da llamada da null y
 * el login queda colgado en el botón).
 */
let _redirectResult: Promise<string | null> | undefined;
export function completeGoogleRedirect(): Promise<string | null> {
  if (!_redirectResult) {
    _redirectResult = getRedirectResult(getClientAuth()).then((r) =>
      r ? r.user.getIdToken() : null,
    );
  }
  return _redirectResult;
}

/**
 * Notifica el usuario de Firebase: el que ya estaba firmado (token guardado en
 * IndexedDB de una sesión anterior que sigue viva) o el que acaba de firmar por
 * popup/redirect. Clave para el caso "Firebase te tiene firmado pero se venció
 * la cookie de sesión de la app": ahí no hay que redirigir a Google de nuevo,
 * solo canjear el token.
 */
export function onFirebaseUser(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(getClientAuth(), cb);
}

export function currentFirebaseUser(): User | null {
  return getClientAuth().currentUser;
}

export async function signOutClient(): Promise<void> {
  await fbSignOut(getClientAuth());
}
