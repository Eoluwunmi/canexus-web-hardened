import SideNav from "@/components/SideNav";

const items = [
  { href: "/dashboard/applicant", label: "Overview" },
  { href: "/dashboard/applicant/passport", label: "Skills Passport" },
  { href: "/dashboard/applicant/coach", label: "AI Career Coach" },
  { href: "/dashboard/applicant/jobs", label: "Jobs" },
  { href: "/dashboard/applicant/funding", label: "Funding" },
  { href: "/dashboard/applicant/mentors", label: "Mentors" },
  { href: "/dashboard/applicant/settings", label: "Settings" },
];

export default function ApplicantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-8 px-6 py-8">
      <SideNav items={items} />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
