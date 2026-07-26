import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import {
  loadRegistrationsByYeshiva,
  buildSingleYeshivaWorkbook,
  buildCombinedWorkbook,
  sanitizeFilename,
} from "@/lib/registration-export";

/**
 * GET /api/registrations/export?from=YYYY-MM-DD&to=YYYY-MM-DD
 *   ↑ combined workbook (one sheet per yeshiva)
 *
 * GET /api/registrations/export?from=...&to=...&yeshiva=NAME
 *   ↑ single-yeshiva workbook (just that one's rows)
 *
 * Source: YemotBedReservation × Student roster. Requires login. Filename is
 * RFC-5987-encoded so Hebrew survives the trip.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const yeshiva = url.searchParams.get("yeshiva");
  const suffix = url.searchParams.get("suffix")?.trim() ?? "";
  const year = url.searchParams.get("year") ?? undefined;

  if (!fromStr || !toStr) return new Response("Missing from/to", { status: 400 });

  const from = new Date(fromStr + "T00:00:00");
  const to = new Date(toStr + "T23:59:59");
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return new Response("Invalid dates", { status: 400 });
  }

  const { columns, groups } = await loadRegistrationsByYeshiva({
    from,
    to,
    year,
  });

  let buf: Buffer;
  let filename: string;
  const suffixTag = suffix ? (suffix.startsWith("_") ? suffix : "_" + suffix) : "";

  if (yeshiva) {
    const rows = groups.get(yeshiva) ?? [];
    if (rows.length === 0)
      return new Response("No rows for that yeshiva", { status: 404 });
    buf = await buildSingleYeshivaWorkbook({ yeshiva, columns, rows });
    filename = sanitizeFilename(yeshiva) + suffixTag + ".xlsx";
  } else {
    buf = await buildCombinedWorkbook({ columns, groups });
    filename = `רישומים_${fromStr}_עד_${toStr}${suffixTag}.xlsx`;
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="registrations.xlsx"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
