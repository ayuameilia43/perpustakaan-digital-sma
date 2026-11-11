import { getToken } from "next-auth/jwt";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isProtectedPage =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/librarian") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/books") ||
    pathname.startsWith("/history") ||
    pathname.startsWith("/fines") ||
    pathname.startsWith("/ebook") ||
    pathname.startsWith("/ai-assistant") ||
    pathname.startsWith("/recommendations") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings");

  if (isAuthPage) {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (isProtectedPage && !token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // RBAC Route Scoping
  if (token) {
    const role = token.role;

    // Admin only routes
    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard?error=UnauthorizedAccess", req.url));
    }

    // Librarian only routes (or Admin)
    if (pathname.startsWith("/librarian") && role !== "LIBRARIAN" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard?error=UnauthorizedAccess", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/librarian/:path*",
    "/catalog/:path*",
    "/books/:path*",
    "/history/:path*",
    "/fines/:path*",
    "/ebook/:path*",
    "/ai-assistant/:path*",
    "/recommendations/:path*",
    "/reports/:path*",
    "/settings/:path*",
    "/login",
  ],
};
