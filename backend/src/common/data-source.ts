export const DATA_SOURCE = {
  REAL: 'REAL',
  DEMO: 'DEMO',
} as const;

export type DataSource = (typeof DATA_SOURCE)[keyof typeof DATA_SOURCE];

export function isDataSource(value: unknown): value is DataSource {
  return value === DATA_SOURCE.REAL || value === DATA_SOURCE.DEMO;
}

export function parseDataSource(value?: string | null): DataSource | undefined {
  if (!value) return undefined;
  const v = value.trim().toUpperCase();
  return isDataSource(v) ? v : undefined;
}

export const DATA_SOURCE_NOTE = '';
