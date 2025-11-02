import { parse } from 'csv-parse/sync';

export function parseCsv(buffer: Buffer) {
  const text = buffer.toString('utf8');
  const records = parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as any[];
  // records is an array of objects (header -> value)
  const header = records.length > 0 ? Object.keys(records[0] as any) : [];
  const rows = records.map((r: any) => header.map((h) => r[h] ?? ''));
  return { header, rows, records };
}
