"use server";

import { revalidatePath } from "next/cache";
import {
  syncPaymentsFromNedarim,
  type PaymentSyncResult,
} from "@/lib/payment-sync";

export async function syncPaymentsNow(): Promise<PaymentSyncResult> {
  const r = await syncPaymentsFromNedarim();
  revalidatePath("/payments");
  revalidatePath("/bachurim");
  return r;
}
