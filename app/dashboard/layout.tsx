import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user } = await requireUser();

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 p-4">
          <Link href="/dashboard" className="font-semibold">
            TaxBridge UK
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-600">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="rounded-md border border-zinc-300 px-2 py-1 hover:bg-zinc-100">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-5xl p-4">{children}</div>
    </div>
  );
}
