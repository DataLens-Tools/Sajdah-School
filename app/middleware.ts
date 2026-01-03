// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;

  const isProtected =
    path.startsWith("/student") ||
    path.startsWith("/teacher") ||
    path.startsWith("/admin") ||
    path.startsWith("/dashboard"); // keep if you still use it

  // Not logged in -> send to login
  if (!user && isProtected) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  // Logged in -> optional role gate (recommended)
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const role = profile?.role;

    if (role === "student" && !path.startsWith("/student")) {
      return NextResponse.redirect(new URL("/student/dashboard", req.url));
    }
    if (role === "teacher" && !path.startsWith("/teacher")) {
      return NextResponse.redirect(new URL("/teacher/dashboard", req.url));
    }
    if (role === "admin" && !path.startsWith("/admin")) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ["/student/:path*", "/teacher/:path*", "/admin/:path*", "/dashboard/:path*"],
};

