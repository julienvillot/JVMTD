import Link from "next/link";
import { signInWithMagicLink, signInWithPassword } from "../actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Sign in · TaxBridge UK" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const message = typeof params.message === "string" ? params.message : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Sign in to TaxBridge UK</h1>
        <p className="mt-1 text-sm text-zinc-600">File your MTD quarterly updates from your spreadsheets.</p>
      </header>

      {!isSupabaseConfigured() && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Supabase isn&apos;t configured yet. Copy <code>.env.example</code> to <code>.env.local</code> and add your project keys.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-900">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-900">
          {message}
        </p>
      )}

      <form action={signInWithPassword} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required className="rounded-md border border-zinc-300 px-3 py-2 font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input name="password" type="password" autoComplete="current-password" required className="rounded-md border border-zinc-300 px-3 py-2 font-normal" />
        </label>
        <button type="submit" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700">
          Sign in
        </button>
      </form>

      <form action={signInWithMagicLink} className="flex flex-col gap-3 border-t border-zinc-200 pt-6">
        <p className="text-sm text-zinc-600">Prefer no password? We&apos;ll email you a sign-in link.</p>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required className="rounded-md border border-zinc-300 px-3 py-2 font-normal" />
        </label>
        <button type="submit" className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100">
          Email me a link
        </button>
      </form>

      <p className="text-sm text-zinc-600">
        No account?{" "}
        <Link href="/register" className="font-medium underline">
          Create one
        </Link>
      </p>
    </main>
  );
}
