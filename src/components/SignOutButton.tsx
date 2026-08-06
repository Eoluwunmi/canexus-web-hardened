import { signOut } from "@/auth";

export default function SignOutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/" });
      }}
    >
      <button className="text-sm font-medium text-ink-soft hover:text-stamp transition-colors">
        Sign out
      </button>
    </form>
  );
}
