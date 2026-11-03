/**
 * Serialization utilities to safely sanitize records and prevent leaking
 * sensitive fields (passwords, tokens, internal IDs) to API consumers.
 */

export function excludeSensitiveFields<
  T extends Record<string, any>,
  K extends keyof T
>(record: T, keys: K[]): Omit<T, K> {
  if (!record || typeof record !== 'object') {
    return record;
  }

  const result = { ...record };
  for (const key of keys) {
    delete result[key];
  }
  return result;
}

export function excludeSensitiveFieldsMany<
  T extends Record<string, any>,
  K extends keyof T
>(records: T[], keys: K[]): Omit<T, K>[] {
  if (!Array.isArray(records)) {
    return [];
  }
  return records.map((rec) => excludeSensitiveFields(rec, keys));
}

/**
 * Safely converts Decimal or BigInt types often returned by PostgreSQL/Prisma
 * into JSON-friendly native types.
 */
export function normalizePrismaValues<T>(data: T): T {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'bigint') {
    return Number(data) as unknown as T;
  }

  // Handle Prisma.Decimal (which has .toNumber())
  if (
    typeof data === 'object' &&
    data !== null &&
    'toNumber' in data &&
    typeof (data as any).toNumber === 'function'
  ) {
    return (data as any).toNumber();
  }

  if (Array.isArray(data)) {
    return data.map((item) => normalizePrismaValues(item)) as unknown as T;
  }

  if (typeof data === 'object' && !(data instanceof Date)) {
    const copy: Record<string, any> = {};
    for (const [key, val] of Object.entries(data)) {
      copy[key] = normalizePrismaValues(val);
    }
    return copy as T;
  }

  return data;
}
