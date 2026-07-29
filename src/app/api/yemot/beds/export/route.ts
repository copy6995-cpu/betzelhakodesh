import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { buildBedsWorkbook } from "@/lib/beds-export";

/** Parse a "YYYY-MM-DD" query param into a Date at local midnight. */
function parseISODateLocal(s: string | null): Date | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

/**
 * GET /api/yemot/beds/export?year=&scope=&filter=&from=&to=
 *   Excel of the bed-reservation matrix matching the /yemot/beds view under
 *   the same filters.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const activeYear = await getActiveYear(url.searchParams.get("year"));
  const scope = url.searchParams.get("scope") === "all" ? "all" : "year";
  const filter =
    url.searchParams.get("filter") === "not-registered"
      ? "not-registered"
      : "";
  const from = parseISODateLocal(url.searchParams.get("from"));
  const to = parseISODateLocal(url.searchParams.get("to"));

  const { buffer } = await buildBedsWorkbook({
    activeYear,
    scope,
    filter,
    from,
    to,
  });

  const parts = ["הזמנות_מיטה", activeYear];
  if (filter === "not-registered") parts.push("לא_רשומים");
  const filename = parts.join("_").replace(/[<>:"/\\|?*\n\r\t]/g, "_") + ".xlsx";

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="beds.xlsx"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
