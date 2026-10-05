import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** Returns the signed-in user (validated with Supabase) or redirects to /login. */
export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/**
 * Requires the session to have passed TOTP MFA (aal2). Needed before any HMRC action,
 * because HMRC's Gov-Client-Multi-Factor fraud header must describe a real MFA event.
 */
export async function requireAal2(returnTo: string) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (data?.currentLevel !== "aal2") {
    redirect(`/mfa?next=${encodeURIComponent(returnTo)}`);
  }
  return { supabase, user };
}

export { safeNextPath } from "@/lib/safe-redirect";
