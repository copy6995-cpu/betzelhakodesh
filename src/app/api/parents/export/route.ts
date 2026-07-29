import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import {
  buildParentsBalanceWorkbook,
  sanitizeFilename,
} from "@/lib/parents-export";

/**
 * GET /api/parents/export?year=&min=
 *   Excel worklist of parents whose remaining balance exceeds `min` (default
 *   1₪) for the given year (defaults to the active school year). Sorted
 *   biggest-debt first.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const year =
    url.searchParams.get("year")?.trim() || (await getActiveYear());
  const minRaw = parseFloat(url.searchParams.get("min") ?? "1");
  const minBalance = Number.isFinite(minRaw) ? minRaw : 1;

  const { buffer } = await buildParentsBalanceWorkbook({ year, minBalance });

  const filename = sanitizeFilename(`הורים_חייבים_${year}`) + ".xlsx";
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="parents.xlsx"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
