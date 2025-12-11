/**
 * Deterministic JSON stringify with sorted keys
 * Used for canonical message signing/verification
 */
export function stableStringify(obj: unknown): string {
  return JSON.stringify(obj, (_, value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.keys(value)
        .sort()
        .reduce((sorted: Record<string, unknown>, key) => {
          sorted[key] = value[key];
          return sorted;
        }, {});
    }
    return value;
  });
}

/**
 * Parse JSON and return the canonicalized string
 */
export function canonicalize(jsonString: string): string {
  const parsed = JSON.parse(jsonString);
  return stableStringify(parsed);
}

