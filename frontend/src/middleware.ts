import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Google OAuth requires an exact JavaScript-origin match. Dev servers are often
 * opened as http://127.0.0.1:3000 while Console only lists http://localhost:3000.
 */
export function middleware(request: NextRequest) {
  if (request.nextUrl.hostname === "127.0.0.1") {
    const url = request.nextUrl.clone();
    url.hostname = "localhost";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
