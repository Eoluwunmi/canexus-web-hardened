import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role: "APPLICANT" | "EMPLOYER" | "MENTOR" | "ADMIN";
  }
  interface Session {
    user: {
      id: string;
      role: "APPLICANT" | "EMPLOYER" | "MENTOR" | "ADMIN";
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "APPLICANT" | "EMPLOYER" | "MENTOR" | "ADMIN";
  }
}
