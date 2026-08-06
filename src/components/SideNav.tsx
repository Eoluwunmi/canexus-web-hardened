"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SideNav({ items }: { items: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="w-52 shrink-0">
      <ul className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-ink text-cream" : "text-ink-soft hover:bg-paper-dim"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
