import { NextResponse, type NextRequest } from "next/server";

export async function middleware(_req: NextRequest) {
  // put auth checks here later if you want
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/teacher/:path*", "/admin/:path*"],
};

