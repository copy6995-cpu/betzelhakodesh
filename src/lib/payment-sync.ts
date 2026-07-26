/**
 * Materialize Nedarim Plus transactions into Payment records.
 *
 * `NedarimTransaction` is the raw feed from the API — we already sync it
 * on its own (see settings/nedarim). But the /payments page and the
 * per-student balance / יתרה fields work off `Payment` rows. This job
 * bridges the two by, for every NedarimTransaction whose kevaId matches
 * some Student.nedarimHook, ensuring there's a Payment tied to that
 * student with:
 *   - externalRef = transactionId  (dedupe key)
 *   - paymentNumber = 0            ("נדרים" — matches the legacy import)
 *   - method       = "נדרים פלוס"
 *   - amount       = transaction.amount
 *   - date         = transaction.transactionTime
 *
 * Idempotent — repeat runs never duplicate a Payment. Picks the student
 * whose row was created BEFORE the transaction date (so a תשפ״ז record
 * imported in July 2026 doesn't hoover up a תשפ״ו transaction from June).
 * Ties broken by year DESC — the newest matching year wins.
 */
import { prisma } from "./prisma";

export interface PaymentSyncResult {
  scannedTransactions: number;
  eligibleTransactions: number; // had a matching student
  created: number;
  alreadyExisted: number;
  unmatchedHooks: number; // transactions with kevaId that no student holds
  noHook: number; // transactions with no kevaId (skipped)
}

export async function syncPaymentsFromNedarim(): Promise<PaymentSyncResult> {
  // Only USD/ILS transactions with an amount are meaningful as Payments.
  // We take everything with kevaId set — the filter for "no student" comes later.
  const transactions = await prisma.nedarimTransaction.findMany({
    where: {
      NOT: [{ kevaId: null }, { kevaId: "" }],
      amount: { not: null },
    },
    select: {
      transactionId: true,
      kevaId: true,
      amount: true,
      transactionTime: true,
    },
  });

  const students = await prisma.student.findMany({
    where: {
      NOT: [{ nedarimHook: null }, { nedarimHook: "" }],
    },
    select: {
      id: true,
      year: true,
      nedarimHook: true,
      createdAt: true,
    },
  });
  // hook → students[] (year DESC so index 0 is newest)
  const byHook = new Map<string, typeof students>();
  for (const s of students) {
    if (!s.nedarimHook) continue;
    const arr = byHook.get(s.nedarimHook) ?? [];
    arr.push(s);
    byHook.set(s.nedarimHook, arr);
  }
  for (const arr of byHook.values()) {
    arr.sort((a, b) => (a.year < b.year ? 1 : a.year > b.year ? -1 : 0));
  }

  // Existing dedupe: which (studentId, externalRef) pairs are already paid?
  const existingKey = new Set<string>();
  const existing = await prisma.payment.findMany({
    where: {
      externalRef: { in: transactions.map((t) => t.transactionId) },
    },
    select: { studentId: true, externalRef: true },
  });
  for (const p of existing) existingKey.add(`${p.studentId}|${p.externalRef}`);

  const result: PaymentSyncResult = {
    scannedTransactions: transactions.length,
    eligibleTransactions: 0,
    created: 0,
    alreadyExisted: 0,
    unmatchedHooks: 0,
    noHook: 0,
  };

  for (const t of transactions) {
    if (!t.kevaId) {
      result.noHook++;
      continue;
    }
    const candidates = byHook.get(t.kevaId) ?? [];
    if (candidates.length === 0) {
      result.unmatchedHooks++;
      continue;
    }
    // Prefer the student whose row existed BEFORE the transaction. Falls
    // back to the newest year when no transaction time is available.
    const eligible = t.transactionTime
      ? candidates.filter((s) => s.createdAt.getTime() <= t.transactionTime!.getTime())
      : candidates;
    const target = eligible[0] ?? candidates[0];
    result.eligibleTransactions++;

    const key = `${target.id}|${t.transactionId}`;
    if (existingKey.has(key)) {
      result.alreadyExisted++;
      continue;
    }
    await prisma.payment.create({
      data: {
        studentId: target.id,
        paymentNumber: 0,
        amount: t.amount!,
        method: "נדרים פלוס",
        date: t.transactionTime,
        externalRef: t.transactionId,
        source: "nedarim",
      },
    });
    existingKey.add(key);
    result.created++;
  }

  return result;
}
