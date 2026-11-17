/**
 * Returns a shallow copy of a row without the given internal columns. Public
 * projections use it so internal integer identities and tenant keys can never
 * reach an HTTP response.
 */
export function withoutKeys<T extends object, K extends keyof T>(
  row: T,
  keys: readonly K[],
): Omit<T, K> {
  const omitted = new Set<PropertyKey>(keys);
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !omitted.has(key)),
  ) as unknown as Omit<T, K>;
}
