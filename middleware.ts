import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Define allowed paths under /trade to prevent infinite rewrites
const ALLOWED_TRADE_PATHS = [
  "/", // maps to /trade
  "/about",
  "/contact",
  "/products",
];

export function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const url = request.nextUrl.clone();

  const isTradeSubdomain = host?.startsWith("trade.");

  if (isTradeSubdomain) {
    const originalPath = url.pathname;

    // Rewrite all trade.example.com/* to /trade/*
    if (!originalPath.startsWith("/trade")) {
      url.pathname =
        originalPath === "/" ? "/trade" : `/trade${originalPath}`;
      return NextResponse.rewrite(url);
    }

    // Optional: Redirect if not a known path
    const rewrittenPath = url.pathname.replace(/^\/trade/, "");
    if (
      rewrittenPath &&
      !ALLOWED_TRADE_PATHS.includes(rewrittenPath) &&
      !rewrittenPath.startsWith("/api") // allow API calls if needed
    ) {
      url.hostname = "example.com";
      url.pathname = originalPath;
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|static|favicon.ico).*)"],
};