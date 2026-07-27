/**
 * Room-layout export — same behavior as Room_Assignment_Manager_Tk.py.
 *
 * Strategy: we DO NOT parse the source workbook into a JS model (as ExcelJS
 * does) — that lossy round-trip drops ~75% of the style sheet + printer
 * settings + drawings and produces a file Excel treats as "recovered".
 * Instead we treat the .xlsx as what it is — a zip of XML files — and edit
 * only what we need:
 *   - `xl/workbook.xml`               → drop <sheet> entries for unused sheets
 *   - `xl/_rels/workbook.xml.rels`    → drop the corresponding relationships
 *   - `[Content_Types].xml`           → drop the content type override
 *   - `xl/worksheets/sheetN.xml`      → for kept sheets, clear cells inside
 *                                       every non-assigned room's range and
 *                                       drop any <mergeCell> fully inside
 *   - other unused sheet files        → delete outright
 *
 * Everything we do not touch (theme, fonts, styles, column widths, row
 * heights, RTL views, drawings, printer settings) survives unchanged.
 */
import * as fs from "fs";
import * as path from "path";
import JSZip from "jszip";
import { prisma } from "./prisma";

const TEMPLATE_PATH = path.join(process.cwd(), "data", "rooms-template.xlsx");
const RANGES_PATH = path.join(process.cwd(), "data", "room-ranges.json");

type Ranges = Record<string, { sheet: string; range: string }>;
type Bounds = { minCol: number; minRow: number; maxCol: number; maxRow: number };

function loadRanges(): Ranges {
  return JSON.parse(fs.readFileSync(RANGES_PATH, "utf-8"));
}

function colToNum(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function parseA1(ref: string): { col: number; row: number } {
  const m = /^\$?([A-Z]+)\$?(\d+)$/.exec(ref);
  if (!m) throw new Error(`bad cell ref: ${ref}`);
  return { col: colToNum(m[1]), row: parseInt(m[2], 10) };
}

function parseA1Range(range: string): Bounds {
  const clean = range.replace(/\$/g, "");
  const [top, bot] = clean.split(":");
  const a = parseA1(top);
  const b = parseA1(bot ?? top);
  return {
    minCol: Math.min(a.col, b.col),
    minRow: Math.min(a.row, b.row),
    maxCol: Math.max(a.col, b.col),
    maxRow: Math.max(a.row, b.row),
  };
}

function isInside(cell: { col: number; row: number }, b: Bounds): boolean {
  return (
    cell.col >= b.minCol &&
    cell.col <= b.maxCol &&
    cell.row >= b.minRow &&
    cell.row <= b.maxRow
  );
}

/**
 * Clear every <c ...>...</c> whose r="..." lies inside any of the given
 * ranges. We collapse it to a bare `<c r="..."/>` so the cell exists (row
 * positioning stays intact) but has no value and no style — matching the
 * Python script's cell.value=None / Font()/Fill()/Border() reset.
 */
function clearCellsInRanges(sheetXml: string, ranges: Bounds[]): string {
  return sheetXml.replace(
    /<c\s+r="([A-Z]+\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g,
    (match, ref: string) => {
      const cell = parseA1(ref);
      for (const b of ranges) {
        if (isInside(cell, b)) return `<c r="${ref}"/>`;
      }
      return match;
    }
  );
}

/**
 * Remove <mergeCell ref="X:Y"/> entries fully inside any of the given
 * ranges, and update the <mergeCells count="N"> attribute to match.
 */
function removeMergesInRanges(sheetXml: string, ranges: Bounds[]): string {
  let removed = 0;
  const stripped = sheetXml.replace(
    /<mergeCell\s+ref="([^"]+)"\s*\/>/g,
    (match, refStr: string) => {
      const [tl, br] = refStr.split(":");
      const tlp = parseA1(tl);
      const brp = br ? parseA1(br) : tlp;
      const box: Bounds = {
        minCol: Math.min(tlp.col, brp.col),
        maxCol: Math.max(tlp.col, brp.col),
        minRow: Math.min(tlp.row, brp.row),
        maxRow: Math.max(tlp.row, brp.row),
      };
      for (const b of ranges) {
        if (
          box.minCol >= b.minCol &&
          box.maxCol <= b.maxCol &&
          box.minRow >= b.minRow &&
          box.maxRow <= b.maxRow
        ) {
          removed++;
          return "";
        }
      }
      return match;
    }
  );
  if (removed === 0) return stripped;
  return stripped.replace(
    /<mergeCells\s+count="(\d+)"/,
    (_, c) => `<mergeCells count="${Math.max(0, parseInt(c, 10) - removed)}"`
  );
}

/**
 * Delete <sheet name="X" ...> entries from workbook.xml, along with their
 * relationships and content-type overrides. Returns the list of sheet
 * files (sheet1.xml etc.) that should be dropped from the zip.
 */
function pruneWorkbookSheets(
  workbookXml: string,
  workbookRelsXml: string,
  contentTypesXml: string,
  sheetsToKeep: Set<string>
): {
  workbookXml: string;
  workbookRelsXml: string;
  contentTypesXml: string;
  droppedSheetFiles: string[];
} {
  // Parse <sheet name="X" sheetId="Y" r:id="rIdZ"/>
  const sheetEntries: Array<{
    fullTag: string;
    name: string;
    rId: string;
  }> = [];
  const sheetRe =
    /<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g;
  let m;
  while ((m = sheetRe.exec(workbookXml))) {
    sheetEntries.push({ fullTag: m[0], name: m[1], rId: m[2] });
  }

  const droppedRIds = new Set(
    sheetEntries.filter((s) => !sheetsToKeep.has(s.name)).map((s) => s.rId)
  );

  // Remove <sheet> tags for dropped sheets from workbook.xml
  let outWb = workbookXml;
  for (const s of sheetEntries) {
    if (droppedRIds.has(s.rId)) {
      outWb = outWb.replace(s.fullTag, "");
    }
  }

  // Remove matching relationships + track which target files they point to
  const droppedTargets: string[] = [];
  let outRels = workbookRelsXml.replace(
    /<Relationship\s+Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g,
    (match, id: string, target: string) => {
      if (droppedRIds.has(id)) {
        droppedTargets.push(target);
        return "";
      }
      return match;
    }
  );

  // Remove content type overrides for dropped sheet files
  let outCT = contentTypesXml;
  for (const t of droppedTargets) {
    // Target is like "worksheets/sheet3.xml" — content-types uses "/xl/worksheets/sheet3.xml"
    const partName = `/xl/${t.replace(/^\/+/, "")}`;
    const escaped = partName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    outCT = outCT.replace(
      new RegExp(
        `<Override\\s+PartName="${escaped}"[^>]*\\/>`,
        "g"
      ),
      ""
    );
  }

  // Strip every <definedName> block. Named ranges reference sheets by
  // name AND by localSheetId (0-based index into <sheets>). Both become
  // stale after we remove sheets — Excel opens the file with a "repair"
  // dialog and silently drops the broken names. Removing the whole
  // <definedNames> element up front avoids that recovery prompt.
  outWb = outWb.replace(/<definedNames>[\s\S]*?<\/definedNames>/g, "");

  // <workbookView firstSheet="N" activeTab="M"> — both are 0-based indexes
  // into the sheet list. After pruning down to (often) a single sheet, a
  // leftover activeTab="1"/firstSheet="1" points past the end → Excel flags
  // "Removed Records: Sheet" and repairs the file (blaming the surviving
  // sheetN.xml). Drop both attributes so they default to 0 — the first
  // surviving sheet is shown, valid for any kept-sheet count.
  outWb = outWb
    .replace(/(<workbookView\b[^>]*?)\s+activeTab="\d+"/g, "$1")
    .replace(/(<workbookView\b[^>]*?)\s+firstSheet="\d+"/g, "$1");

  // Return list of `xl/worksheets/sheet3.xml` paths to drop from the zip
  const droppedSheetFiles = droppedTargets.map(
    (t) => `xl/${t.replace(/^\/+/, "")}`
  );
  return {
    workbookXml: outWb,
    workbookRelsXml: outRels,
    contentTypesXml: outCT,
    droppedSheetFiles,
  };
}

/**
 * Map workbook.xml's <sheet name="X" r:id="Y"> ↔ the actual sheet file
 * path from workbook.xml.rels. Used to know WHICH sheetN.xml holds a
 * given sheet name.
 */
function mapSheetNameToFile(
  workbookXml: string,
  workbookRelsXml: string
): Map<string, string> {
  const nameToRid = new Map<string, string>();
  const sheetRe =
    /<sheet\s+[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"[^>]*\/>/g;
  let m;
  while ((m = sheetRe.exec(workbookXml))) {
    nameToRid.set(m[1], m[2]);
  }
  const ridToTarget = new Map<string, string>();
  const relRe = /<Relationship\s+Id="([^"]+)"[^>]*Target="([^"]+)"[^>]*\/>/g;
  while ((m = relRe.exec(workbookRelsXml))) {
    ridToTarget.set(m[1], m[2]);
  }
  const out = new Map<string, string>();
  for (const [name, rid] of nameToRid) {
    const target = ridToTarget.get(rid);
    if (target) out.set(name, `xl/${target.replace(/^\/+/, "")}`);
  }
  return out;
}

/**
 * Build one .xlsx buffer per yeshiva that has rooms assigned in the given
 * week. Preserves the source workbook byte-for-byte except for the
 * clear/drop edits above.
 */
export async function exportRoomsPerYeshiva(opts: {
  weekKey: string;
}): Promise<{
  files: Map<string, Buffer>;
  warnings: string[];
}> {
  const ranges = loadRanges();
  const warnings: string[] = [];

  const allocations = await prisma.roomAllocation.findMany({
    where: { weekKey: opts.weekKey },
    include: { room: true },
  });
  if (allocations.length === 0) {
    return { files: new Map(), warnings: ["אין שיבוצי חדרים לשבוע זה"] };
  }

  // Group by yeshiva → sheet name → list of assigned ranges
  const byGroup = new Map<string, Map<string, Bounds[]>>();
  for (const a of allocations) {
    const info = ranges[a.room.code];
    if (!info) {
      warnings.push(`חדר ${a.room.code} לא נמצא בקובץ ה-ranges`);
      continue;
    }
    const sheetMap = byGroup.get(a.yeshiva) ?? new Map<string, Bounds[]>();
    const arr = sheetMap.get(info.sheet) ?? [];
    arr.push(parseA1Range(info.range));
    sheetMap.set(info.sheet, arr);
    byGroup.set(a.yeshiva, sheetMap);
  }

  // Every room in the JSON, grouped by sheet — used to know what to clear.
  const allRangesBySheet = new Map<string, Bounds[]>();
  for (const info of Object.values(ranges)) {
    const arr = allRangesBySheet.get(info.sheet) ?? [];
    arr.push(parseA1Range(info.range));
    allRangesBySheet.set(info.sheet, arr);
  }

  // Load the source ONCE.
  const srcBuf = fs.readFileSync(TEMPLATE_PATH);
  const files = new Map<string, Buffer>();

  for (const [yeshiva, sheetsForYeshiva] of byGroup) {
    const zip = await JSZip.loadAsync(srcBuf);

    const workbookXml = await zip.file("xl/workbook.xml")!.async("string");
    const workbookRelsXml = await zip
      .file("xl/_rels/workbook.xml.rels")!
      .async("string");
    const contentTypesXml = await zip
      .file("[Content_Types].xml")!
      .async("string");

    const nameToFile = mapSheetNameToFile(workbookXml, workbookRelsXml);
    const keep = new Set(sheetsForYeshiva.keys());

    // For each kept sheet: clear cells outside this yeshiva's rooms.
    for (const sheetName of keep) {
      const filePath = nameToFile.get(sheetName);
      if (!filePath) {
        warnings.push(`גיליון "${sheetName}" חסר בתבנית (ישיבה ${yeshiva})`);
        continue;
      }
      const assigned = sheetsForYeshiva.get(sheetName) ?? [];
      // Build a Set of ranges to skip — anything NOT in `assigned`
      const clearRanges = (allRangesBySheet.get(sheetName) ?? []).filter(
        (b) =>
          !assigned.some(
            (a) =>
              a.minCol === b.minCol &&
              a.maxCol === b.maxCol &&
              a.minRow === b.minRow &&
              a.maxRow === b.maxRow
          )
      );

      let xml = await zip.file(filePath)!.async("string");
      xml = clearCellsInRanges(xml, clearRanges);
      xml = removeMergesInRanges(xml, clearRanges);
      // <pageSetup ... r:id="rIdN"/> points at the printerSettings rel we're
      // about to drop. Strip the `r:id="..."` attribute so Excel doesn't
      // hunt for a non-existent relationship (that error opens the sheet
      // as "damaged" and truncates it).
      xml = xml.replace(
        /(<pageSetup\b[^>]*?)\s+r:id="[^"]*"/g,
        "$1"
      );
      zip.file(filePath, xml);
    }

    // Prune non-kept sheets from workbook.xml, rels, [Content_Types].xml,
    // and delete the files themselves from the zip.
    const pruned = pruneWorkbookSheets(
      workbookXml,
      workbookRelsXml,
      contentTypesXml,
      keep
    );
    zip.file("xl/workbook.xml", pruned.workbookXml);
    zip.file("xl/_rels/workbook.xml.rels", pruned.workbookRelsXml);
    for (const f of pruned.droppedSheetFiles) {
      zip.remove(f);
      zip.remove(f.replace(/([^/]+)\.xml$/, "_rels/$1.xml.rels"));
    }

    // Strip printerSettings — Excel warns about missing printerSettings
    // parts in a way that's hard to satisfy across kept/removed sheets
    // (each sheet has its own bin, sheet index shifts break the linkage).
    // They're purely print-preview metadata; safe to drop entirely.
    // Collect paths first (JSZip's forEach shouldn't mutate mid-iteration).
    const printerSettingsPaths: string[] = [];
    const survivingRelsPaths: string[] = [];
    zip.forEach((path) => {
      if (path.startsWith("xl/printerSettings/") && path.endsWith(".bin")) {
        printerSettingsPaths.push(path);
      } else if (
        path.startsWith("xl/worksheets/_rels/") &&
        path.endsWith(".xml.rels")
      ) {
        survivingRelsPaths.push(path);
      }
    });
    for (const p of printerSettingsPaths) zip.remove(p);
    // Drop the printerSettings <Relationship> from every kept sheet's rels
    // so no dangling reference remains.
    for (const relsPath of survivingRelsPaths) {
      const stream = zip.file(relsPath);
      if (!stream) continue;
      const xml = await stream.async("string");
      const stripped = xml.replace(
        /<Relationship\s+[^>]*printerSettings[^>]*\/>/g,
        ""
      );
      if (stripped !== xml) zip.file(relsPath, stripped);
    }
    // Remove the .bin default from Content-Types too — no bin files left.
    // Use [^>]* not [^/]* — ContentType URLs contain slashes.
    const outCT = pruned.contentTypesXml.replace(
      /<Default\s+Extension="bin"[^>]*\/>/g,
      ""
    );
    zip.file("[Content_Types].xml", outCT);

    const buf = await zip.generateAsync({ type: "nodebuffer" });
    files.set(yeshiva, buf);
  }

  return { files, warnings };
}

/** Bundle every yeshiva's workbook into a single downloadable zip. */
export async function exportRoomsZip(opts: { weekKey: string }): Promise<{
  buffer: Buffer;
  fileCount: number;
  warnings: string[];
}> {
  const { files, warnings } = await exportRoomsPerYeshiva(opts);
  const zip = new JSZip();
  for (const [yeshiva, buf] of files) {
    const safe = yeshiva.replace(/[<>:"/\\|?*\n\r\t]/g, "_").trim() || "ללא_שם";
    zip.file(`${safe}.xlsx`, buf);
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  return { buffer, fileCount: files.size, warnings };
}
