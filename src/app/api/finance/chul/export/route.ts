import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";

export const runtime = "nodejs";

/**
 * GET /api/finance/chul/export?rep=<repId>
 *   One overseas rep's donations as an .xlsx, with an extra column listing the
 *   personal codes of each donor-parent's bachurim.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const u = session.user as { role?: string; repId?: string | null };

  const repId = new URL(req.url).searchParams.get("rep")?.trim();
  if (!repId) return new Response("missing rep", { status: 400 });
  // A rep may export only their own page.
  if (u.role === "rep" && u.repId !== repId) {
    return new Response("Forbidden", { status: 403 });
  }

  const rep = await prisma.representative.findUnique({
    where: { id: repId },
    include: {
      donations: {
        orderBy: [{ sortOrder: "asc" }, { date: "asc" }, { createdAt: "asc" }],
      },
    },
  });
  if (!rep) return new Response("not found", { status: 404 });

  // Resolve each donor-parent → their bachurim personal codes (deduped).
  const parentIds = [
    ...new Set(
      rep.donations.map((d) => d.parentId).filter((x): x is string => !!x)
    ),
  ];
  const parents = parentIds.length
    ? await prisma.parent.findMany({
        where: { id: { in: parentIds } },
        select: { id: true, students: { select: { personalCode: true } } },
      })
    : [];
  const codesByParent = new Map(
    parents.map((p) => [
      p.id,
      [...new Set(p.students.map((s) => s.personalCode))].join(", "),
    ])
  );

  const rows = rep.donations.map((d) => ({
    "שם התורם": d.donor,
    "תאריך": d.date ? d.date.toISOString().slice(0, 10) : "",
    "דולר": d.usd || "",
    "שער": d.rate ?? "",
    "סה״כ ₪": d.ils || "",
    "הערות": d.notes ?? "",
    "קודי בחורים": d.parentId ? codesByParent.get(d.parentId) ?? "" : "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      "שם התורם",
      "תאריך",
      "דולר",
      "שער",
      "סה״כ ₪",
      "הערות",
      "קודי בחורים",
    ],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "תרומות");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const filename = `תרומות ${rep.name}.xlsx`.replace(/[<>:"/\\|?*\n\r\t]/g, "_");
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="donations.xlsx"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
