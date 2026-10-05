"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { BusinessType, AccountingMethod } from "@/lib/types/database";

export async function getUserBusinesses() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching businesses:", error);
    return [];
  }
  return data ?? [];
}

export async function createBusiness(formData: FormData) {
  const { supabase, user } = await requireUser();

  const tradingName = String(formData.get("trading_name") ?? "").trim();
  const businessType = String(formData.get("business_type") ?? "self_employment") as BusinessType;
  const accountingType = String(formData.get("accounting_type") ?? "CASH") as AccountingMethod;

  if (!tradingName) {
    throw new Error("Trading name is required");
  }

  const { error } = await supabase
    .from("businesses")
    .insert({
      user_id: user.id,
      trading_name: tradingName,
      business_type: businessType,
      accounting_type: accountingType,
    });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/upload");
  revalidatePath("/dashboard/businesses");
}

export async function deleteBusiness(businessId: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("businesses").delete().eq("id", businessId).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/businesses");
  redirect("/dashboard/businesses");
}
