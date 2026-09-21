/** Merge legacy browser rows into native rows without discarding newer data. */
export function mergeVaultRows(nativeRows = [], localRows = []) {
  const merged = new Map();
  for (const row of [...nativeRows, ...localRows]) {
    if (!row?.id) continue;
    const previous = merged.get(row.id);
    if (!previous) {
      merged.set(row.id, row);
      continue;
    }
    const previousTime = new Date(previous.updated_date || 0).getTime();
    const currentTime = new Date(row.updated_date || 0).getTime();
    if (currentTime >= previousTime) merged.set(row.id, row);
  }
  return Array.from(merged.values());
}
