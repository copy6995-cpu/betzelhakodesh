import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getActiveYear } from "@/lib/year";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

/** GET /api/finance/adnei/export — the adnei ledger as .xlsx, with approval status. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const u = session.user as { role?: string; repKind?: string | null };
  // Admins, finance users, and the adnei rep may export.
  if (u.role === "rep" && u.repKind !== "adnei") {
    return new Response("Forbidden", { status: 403 });
  }

  const year = await getActiveYear();
  const entries = await prisma.financeEntry.findMany({
    where: { year, kind: "expense", category: "adnei" },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const parseMeta = (s: string | null): { from?: string; to?: string } => {
    try {
      return s ? JSON.parse(s) : {};
    } catch {
      return {};
    }
  };

  const rows = entries.map((e) => {
    const m = parseMeta(e.meta);
    return {
      "תאריך": e.date ? e.date.toISOString().slice(0, 10) : "",
      "סכום": e.amount || "",
      "סוג תשלום": e.label ?? "",
      "מ-גוף": m.from ?? "",
      "נמסר ל": m.to ?? "",
      "סטטוס": e.approved ? "מאושר" : "ממתין",
      "אושר בתאריך": e.approvedAt ? e.approvedAt.toISOString().slice(0, 10) : "",
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "תאריך",
      "סכום",
      "סוג תשלום",
      "מ-גוף",
      "נמסר ל",
      "סטטוס",
      "אושר בתאריך",
    ],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "אדני הקודש");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `אדני הקודש ${year}.xlsx`.replace(/[<>:"/\\|?*\n\r\t]/g, "_");
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="adnei.xlsx"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
