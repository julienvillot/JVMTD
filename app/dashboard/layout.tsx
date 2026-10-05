import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "../(auth)/actions";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const { user } = await requireUser();

  return (
    <div className="min-h-screen bg-zinc-50/30">
      <header className="border-b border-zinc-200 bg-white sticky top-0 z-30">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
              <span className="w-5 h-5 rounded bg-zinc-900 text-white text-[11px] font-mono flex items-center justify-center">
                TB
              </span>
              TaxBridge UK
            </Link>

            <nav className="flex items-center gap-4 text-sm font-medium text-zinc-600">
              <Link href="/dashboard" className="hover:text-zinc-900 transition-colors">
                Overview
              </Link>
              <Link href="/dashboard/businesses" className="hover:text-zinc-900 transition-colors">
                Businesses
              </Link>
              <Link href="/dashboard/upload" className="hover:text-zinc-900 transition-colors">
                Import Spreadsheet
              </Link>
              <Link href="/dashboard/filing" className="hover:text-zinc-900 transition-colors">
                Filing
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-zinc-500 font-mono hidden sm:inline">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded border border-zinc-200 px-2.5 py-1 text-zinc-700 hover:bg-zinc-100 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
