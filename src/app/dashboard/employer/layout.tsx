import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import SideNav from "@/components/SideNav";
import MfaGraceBanner from "@/components/MfaGraceBanner";

const baseItems = [
  { href: "/dashboard/employer", label: "Overview" },
  { href: "/dashboard/employer/jobs/new", label: "Post a Job" },
  { href: "/dashboard/employer/candidates", label: "Candidate Search" },
  { href: "/dashboard/employer/funding", label: "Funding" },
];

export default async function EmployerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const [row] = session?.user
    ? await db.select({ isEmployerAdmin: users.isEmployerAdmin }).from(users).where(eq(users.id, session.user.id)).limit(1)
    : [];
  const items = row?.isEmployerAdmin ? [...baseItems, { href: "/dashboard/mfa", label: "Security" }] : baseItems;

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
