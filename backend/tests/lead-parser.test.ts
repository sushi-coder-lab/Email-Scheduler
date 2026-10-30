import { describe, it, expect } from 'vitest';
import { parseLeads } from '../src/modules/emails/lead-parser.js';

describe('Lead Parser (CSV & Text)', () => {
  it('parses valid CSV with headers', () => {
    const csvContent = `Email,Name,Company
alice@example.com,Alice,Acme Corp
bob@example.com,Bob,Beta LLC
charlie@example.com,Charlie,Gamma Inc`;

    const result = parseLeads(csvContent, 'leads.csv');

    expect(result.totalDetected).toBe(3);
    expect(result.validCount).toBe(3);
    expect(result.invalidCount).toBe(0);
    expect(result.duplicateCount).toBe(0);
    expect(result.validEmails).toEqual([
      'alice@example.com',
      'bob@example.com',
      'charlie@example.com',
    ]);
  });

  it('filters out invalid emails and deduplicates case-insensitively', () => {
    const csvContent = `email
valid1@test.com
not-an-email
VALID1@test.com
valid2@test.com
another-bad@
valid2@test.com`;

    const result = parseLeads(csvContent, 'leads.csv');

    expect(result.totalDetected).toBe(6);
    expect(result.validCount).toBe(2);
    expect(result.invalidCount).toBe(2);
    expect(result.duplicateCount).toBe(2);
    expect(result.validEmails).toEqual(['valid1@test.com', 'valid2@test.com']);
  });

  it('parses plain text format separated by newlines and commas', () => {
    const textContent = `user1@example.com, user2@example.com
user3@example.com;invalid-email
user1@example.com`;

    const result = parseLeads(textContent, 'leads.txt');

    expect(result.validCount).toBe(3);
    expect(result.invalidCount).toBe(1);
    expect(result.duplicateCount).toBe(1);
    expect(result.validEmails).toEqual([
      'user1@example.com',
      'user2@example.com',
      'user3@example.com',
    ]);
  });
});
