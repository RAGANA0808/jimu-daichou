const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: string): boolean {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function assertValidUuid(value: string, fieldName = 'uuid'): void {
  if (!isValidUuid(value)) {
    throw new TypeError(`Invalid UUID for ${fieldName}`);
  }
}
