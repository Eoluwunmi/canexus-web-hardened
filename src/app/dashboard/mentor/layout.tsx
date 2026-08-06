import SideNav from "@/components/SideNav";

const items = [
  { href: "/dashboard/mentor", label: "Overview" },
  { href: "/dashboard/mentor/profile", label: "My Profile" },
];

export default function MentorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-8 px-6 py-8">
      <SideNav items={items} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
