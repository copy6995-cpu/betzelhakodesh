/**
 * Maps an אגף (Room.building) to the מתחם (complex) it belongs to, for the room
 * export. The office groups several אגפים under one מתחם:
 *   - בית מלכה  = בית מלכה3 + בית מלכה4
 *   - ביהמ"ד    = קומה 1 + קומה 3 + דרעזיל (310-314) + דרעזיל (315-320) +
 *                 חדר סנדוויץ + כוללים
 * Any אגף not listed here is its own מתחם (the title is just the אגף's name,
 * e.g. "דעת משה", "מתמידים"). Export sheets/pages are titled by the מתחם alone
 * (no yeshiva); the PDF and print view merge a מתחם's אגפים onto one page.
 */
const BUILDING_TO_COMPLEX: Record<string, string> = {
  "בית מלכה3": "בית מלכה",
  "בית מלכה4": "בית מלכה",
  "קומה 1 חדרים 100-109": 'ביהמ"ד',
  "קומה 3 חדרים 300-309": 'ביהמ"ד',
  "דרעזיל חדרים 310-314": 'ביהמ"ד',
  "דרעזיל חדרים 315-320": 'ביהמ"ד',
  "חדר סנדוויץ - 321": 'ביהמ"ד',
  "כוללים חדרים 401-404": 'ביהמ"ד',
};

/** The מתחם a given אגף (Room.building) belongs to — itself if unmapped. */
export function complexOf(building: string): string {
  return BUILDING_TO_COMPLEX[building] ?? building;
}
