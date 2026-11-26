// Requires the app password for every page and API route, except those excluded below.
import { NextResponse, type NextRequest } from "next/server";
import { COOKIE, authMode, sessionCookie, validSession } from "@/lib/auth";

export function proxy(req: NextRequest) {
  const mode = authMode();
  if (mode === "open") return NextResponse.next();
  if (mode === "misconfigured")
    return new NextResponse("Locked: set APP_PASSWORD and SESSION_SECRET, then redeploy.", { status: 503 });

  if (validSession(req.cookies.get(COOKIE)?.value)) {
    const res = NextResponse.next();
    res.cookies.set(sessionCookie()); // keeps a phone signed in as long as it keeps using the app
    return res;
  }

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

// Open: the sign-in page and its route, the daily backup (it checks CRON_SECRET itself),
// and static files that hold no data.
export const config = {
  matcher: [
    "/((?!login$|api/login$|api/backup$|_next/static/|_next/image|icon\.svg$|manifest\.webmanifest$).*)",
  ],
};
