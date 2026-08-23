/**
 * Unsaved variant rows have no stable DB id yet, so `keyFor` (in
 * `index.tsx`) falls back to `new-<index>`. Any per-variant UI state keyed
 * the same way — `expanded`, `sheetMode` — silently goes stale when a row
 * is deleted: every later sibling's index shifts down by one, but nothing
 * moves its entry, so it inherits whatever the row that used to sit at
 * that index left behind (AR-135, fix round 3 — a sibling variant briefly
 * rendered another variant's fixed-sheet mode after a delete).
 *
 * `remapIndexKeys` is the one place that reindexing happens, so both state
 * maps stay keyed exactly the way `keyFor` would compute them against the
 * array AFTER the removal, and the fix can't drift between the two.
 */

const NEW_KEY_RE = /^new-(\d+)$/

/**
 * Rebuild a per-variant record after removing the row at `removedIndex`
 * (whose key was `removedKey`, from `keyFor` BEFORE the removal):
 *   - the removed row's own entry is dropped, whatever kind of key it had
 *   - `new-<j>` for j > removedIndex moves to `new-<j-1>`, matching how
 *     that row's `keyFor` result changes once it shifts down
 *   - `new-<j>` for j < removedIndex is untouched
 *   - any key that isn't `new-<digits>` (a real saved id) passes through
 *     unchanged — those keys are stable regardless of array position
 */
export function remapIndexKeys<T>(
  record: Record<string, T>,
  removedIndex: number,
  removedKey: string,
): Record<string, T> {
  const next: Record<string, T> = {}
  for (const [key, value] of Object.entries(record)) {
    if (key === removedKey) continue
    const match = NEW_KEY_RE.exec(key)
    if (!match) {
      next[key] = value
      continue
    }
    const i = Number(match[1])
    next[i > removedIndex ? `new-${i - 1}` : key] = value
  }
  return next
}
