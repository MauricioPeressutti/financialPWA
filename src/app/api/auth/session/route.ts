import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_MS,
  adminAuth,
  createSessionCookie,
} from "@/lib/firebase/admin";
import { ensureTeam, upsertUserFromToken } from "@/lib/users";

export const runtime = "nodejs";

/** Login: recibe el ID token de Firebase, crea la sesión y hace el bootstrap. */
export async function POST(req: Request) {
  const { idToken } = (await req.json()) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: "Falta idToken" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(idToken);
  } catch {
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  const user = await upsertUserFromToken(decoded);
  await ensureTeam(user.id);

  const sessionCookie = await createSessionCookie(idToken);
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, sessionCookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_MS / 1000,
  });

  return NextResponse.json({ ok: true });
}

/** Logout. */
export async function DELETE() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
