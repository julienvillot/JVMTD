"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

function fail(path: "/login" | "/register", message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function signInWithPassword(formData: FormData) {
  if (!isSupabaseConfigured()) fail("/login", "Supabase is not configured yet.");
  const { email, password } = readCredentials(formData);
  if (!email || !password) fail("/login", "Enter your email and password.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) fail("/login", "Invalid email or password.");
  redirect("/dashboard");
}

export async function signUpWithPassword(formData: FormData) {
  if (!isSupabaseConfigured()) fail("/register", "Supabase is not configured yet.");
  const { email, password } = readCredentials(formData);
  if (!email) fail("/register", "Enter your email.");
  if (password.length < 12) fail("/register", "Use a password of at least 12 characters.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error) fail("/register", error.message);

  // With email confirmation enabled there is no session yet.
  if (!data.session) {
    redirect("/login?message=" + encodeURIComponent("Check your email to confirm your account."));
  }
  redirect("/dashboard");
}

export async function signInWithMagicLink(formData: FormData) {
  if (!isSupabaseConfigured()) fail("/login", "Supabase is not configured yet.");
  const email = String(formData.get("email") ?? "").trim();
  if (!email) fail("/login", "Enter your email to receive a sign-in link.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error) fail("/login", error.message);
  redirect("/login?message=" + encodeURIComponent("Check your email for a sign-in link."));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
