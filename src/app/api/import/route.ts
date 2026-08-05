import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { importBachurimFromBuffer, type ImportMode } from "@/lib/import-bachurim";

export const runtime = "nodejs";
// Allow up to ~50MB uploads — the Excel file is ~3MB today, but future
// combined workbooks (multiple years) can easily reach 20-30MB.
export const maxDuration = 300; // seconds — needed for 2,400+ rows sequential insert

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "לא מאומת" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (err) {
    return NextResponse.json(
      { error: `שגיאה בקריאת ה-formData: ${(err as Error).message}` },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  const year = formData.get("year");
  const mode = (formData.get("mode") ?? "replace-year") as ImportMode;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "חסר קובץ" }, { status: 400 });
  }
  if (typeof year !== "string" || !year.trim()) {
    return NextResponse.json({ error: "חסר שם שנה" }, { status: 400 });
  }
  if (
    mode !== "replace-year" &&
    mode !== "skip-if-any-exist" &&
    mode !== "update-existing"
  ) {
    return NextResponse.json({ error: `mode לא תקין: ${mode}` }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importBachurimFromBuffer(buffer, year.trim(), mode);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/import] failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "שגיאה לא צפויה בייבוא" },
      { status: 500 }
    );
  }
}
