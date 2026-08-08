import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { exportRoomsZip, exportRoomsPerYeshiva } from "@/lib/rooms-export";
import { currentWeekKey, weekKeyOf } from "@/lib/weeks";

// Launching headless Chromium (for the bundled PDF) needs the Node runtime and
// more than the default budget — the cold Chromium start alone can take a few s.
export const runtime = "nodejs";
export const maxDuration = 60;

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
  const label = url.searchParams.get("label")?.trim() || "";
  // A single yeshiva → one file just for it (no zip). Netfree blocks .zip.
  const yeshiva = url.searchParams.get("yeshiva")?.trim() || "";

  // format=pdf → a PDF as a single file (no zip): the whole building, or one
  // yeshiva when ?yeshiva= is set. Netfree/filters block .zip, so this is safe.
  if (url.searchParams.get("format") === "pdf") {
    try {
      const { renderRoomsPdf } = await import("@/lib/rooms-pdf");
      const pdf = await renderRoomsPdf({
        weekKey,
        label,
        yeshiva: yeshiva || undefined,
      });
      if (!pdf) {
        return new Response(
          JSON.stringify({ error: "אין שיבוצים לשבוע זה" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        );
      }
      const base = yeshiva ? `${yeshiva} חדרים` : "חלוקת חדרים";
      const filename = `${base}${label ? ` ${label}` : ""}.pdf`;
      return new Response(new Uint8Array(pdf), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="rooms.pdf"; filename*=UTF-8''${encodeURIComponent(
            filename
          )}`,
          "Cache-Control": "no-store",
        },
      });
    } catch (e) {
      return new Response(
        JSON.stringify({
          error: e instanceof Error ? e.message : "שגיאה ביצירת ה-PDF",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      );
    }
  }

  // A single yeshiva → just its .xlsx, no zip.
  if (yeshiva) {
    try {
      const { files } = await exportRoomsPerYeshiva({ weekKey, label });
      const buf = files.get(yeshiva);
      if (!buf) {
        return new Response(
          JSON.stringify({ error: "אין שיבוצים לישיבה זו" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        );
      }
      const safe =
        `${yeshiva} חדרים${label ? ` ${label}` : ""}`.replace(
          /[<>:"/\\|?*\n\r\t]/g,
          "_"
        ) || "חדרים";
      return new Response(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="rooms.xlsx"; filename*=UTF-8''${encodeURIComponent(
            `${safe}.xlsx`
          )}`,
          "Cache-Control": "no-store",
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

  try {
    const { buffer, fileCount, warnings } = await exportRoomsZip({
      weekKey,
      label,
    });
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
