import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { buildFormsWorkbook } from "@/lib/forms-export";

/**
 * GET /api/nedarim/forms/export?tofes=651&snif=תשפ"ז&stat=duplicates
 *   Returns an xlsx of the form's submissions matching the filters.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const tofesId = url.searchParams.get("tofes")?.trim();
  if (!tofesId)
    return new Response("Missing tofes", { status: 400 });

  const snif = url.searchParams.get("snif")?.trim() || undefined;
  const stat = url.searchParams.get("stat")?.trim() || undefined;

  const { buffer, filename } = await buildFormsWorkbook({
    tofesId,
    snif,
    stat: stat as never,
  });

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="forms.xlsx"; filename*=UTF-8''${encodeURIComponent(
        filename
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
