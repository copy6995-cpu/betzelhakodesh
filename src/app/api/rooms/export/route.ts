import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { exportRoomsZip } from "@/lib/rooms-export";
import { currentWeekKey, weekKeyOf } from "@/lib/weeks";

/**
 * GET /api/rooms/export?week=YYYY-MM-DD
 *   Returns a zip with one .xlsx per yeshiva that has assignments for the
 *   given week. Each xlsx is a clone of the master rooms template with
 *   non-assigned room cells cleared out — same output as the Python
 *   Room_Assignment_Manager_Tk script produces.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const raw = url.searchParams.get("week")?.trim();
  const weekKey = raw ? weekKeyOf(new Date(raw)) : currentWeekKey();

  try {
    const { buffer, fileCount, warnings } = await exportRoomsZip({ weekKey });
    if (fileCount === 0) {
      return new Response(
        JSON.stringify({ error: "אין שיבוצים לשבוע זה", warnings }),
        {
          status: 404,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }
    const filename = `חדרים_${weekKey}.zip`;
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="rooms.zip"; filename*=UTF-8''${encodeURIComponent(
          filename
        )}`,
        "Cache-Control": "no-store",
        // Surface any per-sheet warnings in a header so the UI can display
        // them without a second round-trip.
        ...(warnings.length > 0
          ? {
              "X-Export-Warnings": encodeURIComponent(warnings.join(" | ")),
            }
          : {}),
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "שגיאה ביצוא",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      }
    );
  }
}
