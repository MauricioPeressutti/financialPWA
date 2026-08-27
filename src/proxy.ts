import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/session";

// Chequeo liviano: sólo presencia de la cookie. La verificación real
// (firma del token) se hace en los Server Components / route handlers.
const PUBLIC_PATHS = ["/sign-in", "/join"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE_NAME);
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // El "ya logueado -> /" se decide en /sign-in con verificación real del
  // token; hacerlo acá con sólo la cookie causa loop si la sesión venció.
  return NextResponse.next();
}

export const config = {
  // Excluye: api, _next, __/ (handlers de Firebase Auth), healthz y cualquier
  // archivo con extensión (íconos, manifest…) — si no, se redirigen a /sign-in.
  matcher: ["/((?!api/|_next/|__/|healthz|.*\\.[\\w]+$).*)"],
};
