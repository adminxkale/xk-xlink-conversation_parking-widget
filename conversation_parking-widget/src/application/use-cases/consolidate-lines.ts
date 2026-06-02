import { Line } from '../../domain/entities/line';

/**
 * Consolidates lines from multiple groups, removing duplicates by phone_number.
 * When duplicates are found, merges the groups arrays.
 * First occurrence wins for non-groups fields (id, number, phone_number_id).
 * Returns a deduplicated array of Lines.
 */
export function consolidateLines(lineGroups: Line[][]): Line[] {
  const lineMap = new Map<string, Line>();

  for (const group of lineGroups) {
    for (const line of group) {
      const existing = lineMap.get(line.phone_number);
      if (existing) {
        // Merge groups arrays, avoiding duplicate group IDs
        const existingGroups = existing.groups ?? [];
        const newGroups = line.groups ?? [];
        const mergedGroups = [...new Set([...existingGroups, ...newGroups])];
        lineMap.set(line.phone_number, { ...existing, groups: mergedGroups });
      } else {
        lineMap.set(line.phone_number, { ...line });
      }
    }
  }

  return Array.from(lineMap.values());
}
