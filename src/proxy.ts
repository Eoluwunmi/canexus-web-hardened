import { auth } from "@/auth";
import { NextResponse } from "next/server";

const roleHome: Record<string, string> = {
  APPLICANT: "/dashboard/applicant",
  EMPLOYER: "/dashboard/employer",
  MENTOR: "/dashboard/mentor",
  ADMIN: "/dashboard/admin",
};

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;

  const isProtected = nextUrl.pathname.startsWith("/dashboard");
  if (!isProtected) return NextResponse.next();

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Keep users inside their own role's section of the dashboard.
  const section = nextUrl.pathname.split("/")[2]; // applicant | employer | mentor | admin | mfa
  // /dashboard/mfa is shared: any authenticated user can reach it, but the page itself
  // (src/app/dashboard/mfa/page.tsx) only renders enrollment content for MFA-eligible roles
  // (ADMIN / employer-admin) and shows a plain "not applicable" message otherwise.
  if (section === "mfa") return NextResponse.next();

  const allowed: Record<string, string> = { APPLICANT: "applicant", EMPLOYER: "employer", MENTOR: "mentor", ADMIN: "admin" };
  if (section && role && section !== allowed[role]) {
    return NextResponse.redirect(new URL(roleHome[role] ?? "/", nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*"],
};
