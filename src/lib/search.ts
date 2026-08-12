/**
 * Free-text search that spans several columns. A multi-word query must match
 * ALL words, each word against ANY of the given fields — so "שמעון שטארק"
 * (first name + last name, in either order) returns the row even though no
 * single column contains the whole string. A single word keeps the simple
 * "any field contains it" behavior.
 */
export function tokenSearchWhere(
  q: string,
  fields: string[]
): Record<string, unknown> | undefined {
  const query = (q ?? "").trim();
  if (!query) return undefined;
  const tokens = query.split(/\s+/).filter(Boolean);
  const orFor = (t: string) => ({
    OR: fields.map((f) => ({ [f]: { contains: t } })),
  });
  if (tokens.length === 1) return orFor(tokens[0]);
  return { AND: tokens.map(orFor) };
}
