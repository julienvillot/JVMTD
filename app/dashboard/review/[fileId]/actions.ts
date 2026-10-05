"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

export async function updateTransactionCategory(
  transactionId: string,
  newCategory: string,
  fileId: string
) {
  const { supabase, user } = await requireUser();

  const isExcluded = newCategory === "excluded";

  const { error } = await supabase
    .from("transactions")
    .update({
      hmrc_category: newCategory,
      is_excluded: isExcluded,
      classified_by: "user",
      confidence: 1.0,
      is_reviewed: true,
    })
    .eq("id", transactionId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/review/${fileId}`);
  return { success: true };
}

export async function approveAllTransactions(fileId: string) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("transactions")
    .update({ is_reviewed: true })
    .eq("file_id", fileId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/review/${fileId}`);
  revalidatePath("/dashboard/filing");
  return { success: true };
}

export async function deleteUploadedFile(fileId: string) {
  const { supabase, user } = await requireUser();

  // Transactions cascade on delete of uploaded_files
  const { error } = await supabase
    .from("uploaded_files")
    .delete()
    .eq("id", fileId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/upload");
  redirect("/dashboard/upload");
}
