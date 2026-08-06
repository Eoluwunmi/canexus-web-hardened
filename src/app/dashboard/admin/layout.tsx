import { auth } from "@/auth";
import { redirect } from "next/navigation";
import SideNav from "@/components/SideNav";
import MfaGraceBanner from "@/components/MfaGraceBanner";

const items = [
  { href: "/dashboard/admin", label: "Overview" },
  { href: "/dashboard/admin/audit-log", label: "Audit Log" },
  { href: "/dashboard/admin/verification", label: "Skill Verification" },
  { href: "/dashboard/admin/funding", label: "Funding" },
  { href: "/dashboard/mfa", label: "Security" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }
  return (
    <div className="flex gap-8 px-6 py-8">
      <SideNav items={items} />
      <main className="flex-1 min-w-0 space-y-6">
        <MfaGraceBanner />
        {children}
      </main>
    </div>
  );
}
