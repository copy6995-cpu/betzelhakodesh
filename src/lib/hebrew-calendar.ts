/**
 * Weekly Hebrew-year rows for the calendar page. One row per Shabbat between
 * a Gregorian start/end range, each carrying an auto Hebrew date, parasha,
 * and special-Shabbat note (Rosh Chodesh, Chanukah, Shirah, the arba
 * parshiyot, HaGadol, Shuva, Chazon, Nachamu, …) computed with @hebcal/core.
 */
import { HDate, HebrewCalendar, flags } from "@hebcal/core";

export type CalendarWeekRow = {
  /** Shabbat's ISO date, also the DB weekKey. */
  weekKey: string;
  /** Gregorian date, dd/mm/yyyy. */
  greg: string;
  /** Hebrew date, no nikud (e.g. "25 אב תשפ״ו"). */
  heb: string;
  /** Weekly parasha, no nikud. */
  parasha: string;
  /** Special-Shabbat note(s), joined by " · " ("" when none). */
  note: string;
};

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

export function buildCalendarWeeks(start: Date, end: Date): CalendarWeekRow[] {
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
  // First Shabbat on/after start.
  let hd = new HDate(start);
  while (hd.getDay() !== 6) hd = hd.next();

  const rows: CalendarWeekRow[] = [];
  for (; hd.abs() <= endHD.abs(); hd = hd.add(7, "d")) {
    const key = isoOf(hd);
    const evs = byDay.get(key) ?? [];
    let parasha = "";
    const notes: string[] = [];
    let rch: string | null = null;
    let chanukah = false;
    for (const e of evs) {
      const f = e.getFlags();
      const name = clean(e.render("he"));
      if (f & flags.PARSHA_HASHAVUA) {
        parasha = name.replace(/^פרשת\s*/, "");
      } else if (f & flags.SPECIAL_SHABBAT) {
        notes.push(name);
      } else if (f & flags.ROSH_CHODESH) {
        rch = name.replace(/^ראש חודש\s*/, 'ר"ח ');
      } else if (
        f & (flags.CHANUKAH_CANDLES | flags.MINOR_HOLIDAY) &&
        /חנוכה/.test(name)
      ) {
        chanukah = true;
      }
    }
    if (rch) notes.unshift(`שבת ${rch}`);
    if (chanukah && !notes.some((n) => /חנוכה/.test(n))) {
      notes.push("שבת חנוכה");
    }

    rows.push({
      weekKey: key,
      greg: dmyOf(key),
      heb: clean(hd.render("he")),
      parasha,
      note: notes.join(" · "),
    });
  }
  return rows;
}
