import Link from "next/link";
import { signUpWithPassword } from "../actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata = { title: "Create account · TaxBridge UK" };

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-zinc-600">You&apos;ll set up two-factor authentication before connecting to HMRC.</p>
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

      <form action={signUpWithPassword} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input name="email" type="email" autoComplete="email" required className="rounded-md border border-zinc-300 px-3 py-2 font-normal" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password (12+ characters)
          <input name="password" type="password" autoComplete="new-password" minLength={12} required className="rounded-md border border-zinc-300 px-3 py-2 font-normal" />
        </label>
        <button type="submit" className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700">
          Create account
        </button>
      </form>

      <p className="text-sm text-zinc-600">
        Already registered?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </main>
  );
}
