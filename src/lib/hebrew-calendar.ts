/**
 * Daily Hebrew-year rows for the calendar page. One row PER DAY between a
 * Gregorian start/end range, each carrying an auto Hebrew date, day-of-week,
 * parasha (on Shabbat), and a holiday/notable-day note — Rosh Hashana, Yom
 * Kippur, Sukkot (incl. chol hamoed + Hoshana Rabba), Shmini Atzeret,
 * Chanukah night-by-night, Purim, Pesach, Shavuot, the fasts, Rosh Chodesh,
 * and the special Shabbatot — computed with @hebcal/core.
 */
import { HDate, HebrewCalendar, flags } from "@hebcal/core";

export type CalendarDayRow = {
  /** The day's ISO date, also the DB key. */
  dayKey: string;
  /** Gregorian date, dd/mm/yyyy. */
  greg: string;
  /** Hebrew weekday name (ראשון…שבת). */
  dayName: string;
  /** Hebrew date, no nikud. */
  heb: string;
  /** Weekly parasha (Shabbat rows only), no nikud. */
  parasha: string;
  /** Holiday / notable-day note(s), joined by " · " ("" when none). */
  note: string;
  isShabbat: boolean;
  isYomTov: boolean;
};

const DOW = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

/** Flags whose events belong in the note column. */
const NOTE_MASK =
  flags.CHAG |
  flags.CHOL_HAMOED |
  flags.ROSH_CHODESH |
  flags.MINOR_HOLIDAY |
  flags.MAJOR_FAST |
  flags.MINOR_FAST |
  flags.SPECIAL_SHABBAT;

/** Obscure custom "holidays" @hebcal emits that clutter an office calendar. */
const NOTE_BLOCK = /למעשר בהמה|חג הבנות|סליחות|שבת מברכים|יום כיפור קטן/;

/** Strip nikud + cantillation (all NFD nonspacing marks), turn the Hebrew
 *  maqaf into a space, collapse whitespace. */
function clean(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/־/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isoOf(hd: HDate): string {
  return hd.greg().toISOString().slice(0, 10);
}

function dmyOf(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

const LETTER_VALUE: Record<string, number> = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ך: 20, ל: 30, מ: 40, ם: 40, נ: 50, ן: 50,
  ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
};

/** Hebrew school-year label ("תשפ״ז") → Hebrew year number (5787). */
export function hebYearFromLabel(label: string): number {
  const letters = label.replace(/["'׳״\s]/g, "");
  let sum = 0;
  for (const ch of letters) sum += LETTER_VALUE[ch] ?? 0;
  return sum < 1000 ? 5000 + sum : sum;
}

/**
 * Default calendar range for a school year: 22 Av of the prior Hebrew year
 * through 22 Av of the label's Hebrew year (e.g. תשפ״ז → 22 Av 5786 → 22 Av
 * 5787). The office can override both dates.
 */
export function defaultRangeForYear(yearLabel: string): { start: Date; end: Date } {
  const y = hebYearFromLabel(yearLabel);
  return {
    start: new HDate(22, "Av", y - 1).greg(),
    end: new HDate(22, "Av", y).greg(),
  };
}

/** The parasha (no nikud, no "פרשת" prefix) of the Shabbat in the week that
 *  starts on `sunday`. "" if none (e.g. a yom-tov week). */
export function parashaForWeek(sunday: Date): string {
  const sat = new Date(sunday);
  sat.setDate(sat.getDate() + 6);
  const events = HebrewCalendar.calendar({
    start: sat,
    end: sat,
    sedrot: true,
    il: true,
  });
  for (const e of events) {
    if (e.getFlags() & flags.PARSHA_HASHAVUA) {
      return clean(e.render("he")).replace(/^פרשת\s*/, "");
    }
  }
  return "";
}

export function buildCalendarDays(start: Date, end: Date): CalendarDayRow[] {
  if (!(start < end)) return [];

  const events = HebrewCalendar.calendar({
    start,
    end,
    sedrot: true,
    il: true,
  });
  const byDay = new Map<string, typeof events>();
  for (const e of events) {
    const key = isoOf(e.getDate());
    const arr = byDay.get(key) ?? [];
    arr.push(e);
    byDay.set(key, arr);
  }

  const endHD = new HDate(end);
  const rows: CalendarDayRow[] = [];
  for (let hd = new HDate(start); hd.abs() <= endHD.abs(); hd = hd.add(1, "d")) {
    const key = isoOf(hd);
    const evs = byDay.get(key) ?? [];
    let parasha = "";
    let isYomTov = false;
    const notes: string[] = [];
    for (const e of evs) {
      const f = e.getFlags();
      const name = clean(e.render("he"));
      if (f & flags.PARSHA_HASHAVUA) {
        parasha = name.replace(/^פרשת\s*/, "");
      } else if (f & NOTE_MASK && !NOTE_BLOCK.test(name)) {
        notes.push(name);
      }
      if (f & flags.CHAG) isYomTov = true;
    }

    rows.push({
      dayKey: key,
      greg: dmyOf(key),
      dayName: DOW[hd.getDay()],
      // Hebrew date in gematriya letters ("כ״ב אב תשפ״ו") rather than digits.
      heb: clean(hd.renderGematriya(true)),
      parasha,
      note: notes.join(" · "),
      isShabbat: hd.getDay() === 6,
      isYomTov,
    });
  }
  return rows;
}
