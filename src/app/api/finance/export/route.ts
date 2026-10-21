import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import { loadCancellations, isLiveBooking } from "@/lib/bed-cancellations";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

const nis = (n: number) => Math.round(n);
const isoD = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/**
 * GET /api/finance/export?section=<key>
 * One Excel file per finance section (income + expenses). `section` is one of:
 * income-manual | supervisors | misc | nedarim | groups | chul | reps | beit-malka.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  if ((session.user as { role?: string }).role === "rep") {
    return new Response("Forbidden", { status: 403 });
  }

  const section = new URL(req.url).searchParams.get("section")?.trim() ?? "";
  const year = await getActiveYear();

  let rows: Record<string, unknown>[] = [];
  let sheet = "ייצוא";

  if (section === "income-manual") {
    sheet = "הכנסות ידני";
    const catLabel: Record<string, string> = {
      other: "אחר",
      check: "צ׳ק",
      transfer: "העברה",
    };
    const es = await prisma.financeEntry.findMany({
      where: { year, kind: "income" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    rows = es.map((e) => ({
      "תאריך": isoD(e.date),
      "קטגוריה": catLabel[e.category] ?? e.category,
      "תיאור": e.label ?? "",
      "סכום": nis(e.amount),
    }));
  } else if (section === "supervisors" || section === "misc") {
    const cat = section === "supervisors" ? "supervisor-payment" : "misc";
    sheet = section === "supervisors" ? "משגיחים" : "הוצאות שונות";
    const label = section === "supervisors" ? "שם משגיח" : "תיאור";
    const es = await prisma.financeEntry.findMany({
      where: { year, kind: "expense", category: cat },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    rows = es.map((e) => ({
      "תאריך": isoD(e.date),
      [label]: e.label ?? "",
      "סכום": nis(e.amount),
    }));
  } else if (section === "nedarim") {
    sheet = "נדרים פלוס";
    const ps = await prisma.payment.findMany({
      where: { method: "נדרים פלוס", student: { year } },
      orderBy: { date: "desc" },
      include: { student: { select: { firstName: true, lastName: true, personalCode: true } } },
    });
    rows = ps.map((p) => ({
      "תאריך": isoD(p.date),
      "בחור": `${p.student.lastName} ${p.student.firstName}`.trim(),
      "קוד אישי": p.student.personalCode,
      "סכום": nis(Number(p.amount)),
      "אסמכתא": p.externalRef ?? "",
    }));
  } else if (section === "groups") {
    sheet = "אשראי קבוצות";
    const [res, cancellations] = await Promise.all([
      prisma.yemotBedReservation.findMany({
        where: { status: "מאושר" },
        select: { personalCode: true, weekKey: true, source: true, raw: true },
      }),
      loadCancellations(),
    ]);
    for (const r of res) {
      if (!isLiveBooking(r, cancellations)) continue;
      let pay = 0;
      try {
        pay = Number(JSON.parse(r.raw)["סכום לתשלום"]) || 0;
      } catch {
        /* ignore */
      }
      if (!pay) continue;
      rows.push({
        "קוד אישי": r.personalCode,
        "שבוע": r.weekKey,
        "מקור": r.source,
        "סכום לתשלום": nis(pay),
      });
    }
  } else if (section === "chul") {
    sheet = "נציגי חול";
    const reps = await prisma.representative.findMany({
      where: { year, kind: "chul" },
      include: {
        donations: {
          orderBy: [{ sortOrder: "asc" }, { date: "asc" }, { createdAt: "asc" }],
        },
      },
    });
    const parentIds = [
      ...new Set(
        reps.flatMap((r) => r.donations.map((d) => d.parentId)).filter((x): x is string => !!x)
      ),
    ];
    const parents = parentIds.length
      ? await prisma.parent.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, students: { select: { personalCode: true } } },
        })
      : [];
    const codesByParent = new Map(
      parents.map((p) => [p.id, [...new Set(p.students.map((s) => s.personalCode))].join(", ")])
    );
    for (const rep of reps) {
      for (const d of rep.donations) {
        rows.push({
          "נציג": rep.name,
          "שם התורם": d.donor,
          "תאריך": isoD(d.date),
          "דולר": d.usd || "",
          "שער": d.rate ?? "",
          "סה״כ ₪": nis(d.ils),
          "קודי בחורים": d.parentId ? codesByParent.get(d.parentId) ?? "" : "",
        });
      }
    }
  } else if (section === "reps") {
    sheet = "נציגים בישיבות";
    const reps = await prisma.representative.findMany({
      where: { year, kind: "yeshiva" },
      orderBy: { sortOrder: "asc" },
    });
    rows = reps.map((r) => {
      let total = 0;
      try {
        const a = JSON.parse(r.amounts) as Record<string, number>;
        total = Object.values(a).reduce((s, n) => s + (Number(n) || 0), 0);
      } catch {
        /* ignore */
      }
      return {
        "נציג": r.name,
        "ישיבה": r.yeshiva ?? "",
        "סה״כ ששולם": nis(total),
      };
    });
  } else if (section === "beit-malka") {
    sheet = "בית מלכה";
    const bm = await prisma.beitMalkaRow.findMany({
      where: { year },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    rows = bm.map((r) => ({
      "שבת / סיבה": r.reason,
      "סוג": r.kind,
      "מיטות": r.beds || "",
      "סכום": nis(r.amount),
      "שולם": nis(r.paid),
      "נשאר": nis(r.amount - r.paid),
      "אמצעי": r.method ?? "",
      "תאריך": isoD(r.date),
    }));
  } else {
    return new Response("unknown section", { status: 400 });
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet.slice(0, 31));
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `${sheet} ${year}.xlsx`.replace(/[<>:"/\\|?*\n\r\t]/g, "_");

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="finance.xlsx"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
