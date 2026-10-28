import { parse } from 'csv-parse/sync';

export interface LeadParseResult {
  totalDetected: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  validEmails: string[];
  invalidEntries: string[];
  duplicateEmails: string[];
  preview: Array<{ email: string; isValid: boolean; reason?: string }>;
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function parseLeads(content: string, filename = 'leads.csv'): LeadParseResult {
  const isCsv = filename.toLowerCase().endsWith('.csv');
  const rawEntries: string[] = [];

  if (isCsv) {
    try {
      const records = parse(content, {
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true,
      }) as string[][];

      // Detect email column: check header or inspect cells
      if (records.length > 0) {
        let emailColIdx = -1;
        const firstRow = records[0];

        // Check if first row is header
        for (let i = 0; i < firstRow.length; i++) {
          const colName = firstRow[i].toLowerCase().trim();
          if (colName === 'email' || colName === 'e-mail' || colName === 'recipient' || colName === 'email address') {
            emailColIdx = i;
            break;
          }
        }

        const startIndex = emailColIdx !== -1 ? 1 : 0;
        if (emailColIdx === -1) {
          // If no explicit header, search for any column having @ symbol
          for (let r = 0; r < Math.min(5, records.length); r++) {
            for (let c = 0; c < records[r].length; c++) {
              if (records[r][c].includes('@')) {
                emailColIdx = c;
                break;
              }
            }
            if (emailColIdx !== -1) break;
          }
          if (emailColIdx === -1) emailColIdx = 0;
        }

        for (let r = startIndex; r < records.length; r++) {
          const row = records[r];
          if (row && row[emailColIdx] !== undefined) {
            rawEntries.push(row[emailColIdx]);
          }
        }
      }
    } catch {
      // Fallback to line-by-line parsing if CSV parsing fails
      const lines = content.split(/[\r\n]+/);
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) rawEntries.push(trimmed);
      }
    }
  } else {
    // Plain text: split by commas, semicolons, or newlines
    const tokens = content.split(/[\r\n,;]+/);
    for (const token of tokens) {
      const trimmed = token.trim();
      if (trimmed) rawEntries.push(trimmed);
    }
  }

  const seen = new Set<string>();
  const validEmails: string[] = [];
  const invalidEntries: string[] = [];
  const duplicateEmails: string[] = [];
  const preview: Array<{ email: string; isValid: boolean; reason?: string }> = [];

  for (const entry of rawEntries) {
    const cleaned = entry.trim();
    if (!cleaned) continue;

    // Check syntax
    if (!EMAIL_REGEX.test(cleaned)) {
      invalidEntries.push(cleaned);
      if (preview.length < 50) {
        preview.push({ email: cleaned, isValid: false, reason: 'Invalid email syntax' });
      }
      continue;
    }

    const normalized = cleaned.toLowerCase();
    if (seen.has(normalized)) {
      duplicateEmails.push(normalized);
      if (preview.length < 50) {
        preview.push({ email: normalized, isValid: false, reason: 'Duplicate in file' });
      }
      continue;
    }

    seen.add(normalized);
    validEmails.push(normalized);
    if (preview.length < 50) {
      preview.push({ email: normalized, isValid: true });
    }
  }

  return {
    totalDetected: rawEntries.length,
    validCount: validEmails.length,
    invalidCount: invalidEntries.length,
    duplicateCount: duplicateEmails.length,
    validEmails,
    invalidEntries,
    duplicateEmails,
    preview,
  };
}
