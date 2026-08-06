import { auth } from "@/auth";
import Link from "next/link";
import SignOutButton from "@/components/SignOutButton";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-paper-dim bg-cream">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-semibold text-ink">
            CANexus
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-ink-soft font-mono">
              {session?.user?.name} · {session?.user?.role}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <div className="flex-1 max-w-7xl mx-auto w-full">{children}</div>
    </div>
  );
}
