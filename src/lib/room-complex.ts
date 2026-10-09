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

/** Short display label for an אגף (wing), used in the "[מתחם] - [אגף]"
 *  sub-header. Falls back to the raw building name. */
const WING_LABEL: Record<string, string> = {
  "בית מלכה3": "בניין 3",
  "בית מלכה4": "בניין 4",
  "קומה 1 חדרים 100-109": "קומה 1",
  "קומה 3 חדרים 300-309": "קומה 3",
  "דרעזיל חדרים 310-314": "דרעזיל 310-314",
  "דרעזיל חדרים 315-320": "דרעזיל 315-320",
  "חדר סנדוויץ - 321": "חדר סנדוויץ",
  "כוללים חדרים 401-404": "כוללים",
};

export function wingLabel(building: string): string {
  return WING_LABEL[building] ?? building;
}

/**
 * Block header for one אגף in the export: "[מתחם] - [אגף]"
 * (e.g. "ביהמ"ד - קומה 3", "בית מלכה - בניין 3"). When the אגף is its own מתחם
 * (no grouping, e.g. דעת משה / מתמידים) it's just the מתחם name.
 */
export function complexWingHeader(building: string): string {
  const complex = complexOf(building);
  return complex === building ? complex : `${complex} - ${wingLabel(building)}`;
}

// Physical/logical display order of אגפים: ביהמ"ד wings first (by room number),
// then בית מלכה, then the standalone מתחמים. Unlisted אגפים sort last.
const BUILDING_ORDER = [
  "קומה 1 חדרים 100-109",
  "קומה 3 חדרים 300-309",
  "דרעזיל חדרים 310-314",
  "דרעזיל חדרים 315-320",
  "חדר סנדוויץ - 321",
  "כוללים חדרים 401-404",
  "בית מלכה3",
  "בית מלכה4",
  "דעת משה",
  "מתמידים",
];

/** Sort rank for an אגף (lower = earlier); unlisted sort last. */
export function buildingRank(building: string): number {
  const i = BUILDING_ORDER.indexOf(building);
  return i === -1 ? BUILDING_ORDER.length : i;
}
