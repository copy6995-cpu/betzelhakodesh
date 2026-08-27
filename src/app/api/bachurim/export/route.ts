import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import {
  buildBachurimWorkbook,
  buildBachurimGroupsCsv,
  sanitizeFilename,
} from "@/lib/bachurim-export";

/**
 * GET /api/bachurim/export?year=&status=&yeshiva=&q=
 *   Returns an xlsx workbook of bachurim matching the current filters,
 *   grouped into one sheet per yeshiva plus a combined "כל הבחורים" sheet.
 *
 *   All query params are optional. year defaults to the active school year.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const year =
    url.searchParams.get("year")?.trim() || (await getActiveYear());
  const status = (url.searchParams.get("status")?.trim() ??
    undefined) as string | undefined;
  const yeshiva = url.searchParams.get("yeshiva")?.trim() || undefined;
  const q = url.searchParams.get("q")?.trim() || undefined;

  // Yemot "groups" upload — a CSV in the exact template the office uses.
  if (url.searchParams.get("format")?.trim() === "groups") {
    const csv = await buildBachurimGroupsCsv({
      year,
      status: status as never,
      yeshiva,
      q,
    });
    const parts = ["קבוצות"];
    if (yeshiva) parts.push(sanitizeFilename(yeshiva));
    if (status && status !== "all") parts.push(status);
    parts.push(year);
    const fname = parts.join("_") + ".csv";
    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="groups.csv"; filename*=UTF-8''${encodeURIComponent(
          fname
        )}`,
        "Cache-Control": "no-store",
      },
    });
  }

  const buf = await buildBachurimWorkbook({
    year,
    // Narrow at runtime — bachurim-export re-exports the same status union
    // shape as the page, but URL params are strings.
    status: status as never,
    yeshiva,
    q,
  });

  const parts: string[] = ["בחורים"];
  if (yeshiva) parts.push(sanitizeFilename(yeshiva));
  if (status && status !== "all") parts.push(status);
  parts.push(year);
  const filename = parts.join("_") + ".xlsx";

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="bachurim.xlsx"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
