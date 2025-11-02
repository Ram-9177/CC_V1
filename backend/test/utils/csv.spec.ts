import { parseCsv } from '../../src/utils/csv';

describe('CSV parser', () => {
  it('parses simple csv into records', () => {
    const csv = 'hallticket,firstName,lastName\nHT001,Ravi,Kumar\nHT002,Priya,Sharma';
    const { records } = parseCsv(Buffer.from(csv, 'utf8')) as any;
    expect(records).toHaveLength(2);
    expect(records[0].hallticket).toBe('HT001');
    expect(records[1].firstName).toBe('Priya');
  });
});
