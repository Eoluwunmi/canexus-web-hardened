import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function DashboardRoot() {
  const session = await auth();
  const role = session?.user?.role;
  if (role === "EMPLOYER") redirect("/dashboard/employer");
  if (role === "MENTOR") redirect("/dashboard/mentor");
  if (role === "ADMIN") redirect("/dashboard/admin");
  redirect("/dashboard/applicant");
}
