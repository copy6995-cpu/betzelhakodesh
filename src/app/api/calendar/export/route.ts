import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getActiveYear } from "@/lib/year";
import { buildCalendarWorkbook } from "@/lib/calendar-export";

/** GET /api/calendar/export?year= — the whole calendar board + totals row. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const yearLabel =
    url.searchParams.get("year")?.trim() || (await getActiveYear());
  const buffer = await buildCalendarWorkbook(yearLabel);

  const filename =
    `לוח_שנה_${yearLabel}`.replace(/[<>:"/\\|?*\n\r\t]/g, "_") + ".xlsx";
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="calendar.xlsx"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
