import { BankRecord, BookRecord } from '../types';

// Helper to parse "1,234.56" or "1234.56" to number
const parseAmount = (value: string): number => {
  if (!value) return 0;
  const clean = value.replace(/['",]/g, '');
  return parseFloat(clean);
};

// Helper to parse "d/m/yyyy" to Date object
const parseDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    // Note: Month is 0-indexed in JS
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date();
};

// Robust CSV Line Splitter that handles quoted commas
const splitCSVLine = (line: string): string[] => {
  const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
  // Fallback if simple regex fails (e.g. empty fields), use a more complex split
  // For the specific provided data, a simple lookahead split usually works:
  // Split by comma NOT inside quotes
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts.map(p => p.trim().replace(/^"|"$/g, ''));
};

export const parseBankCSV = (csvText: string): BankRecord[] => {
  const lines = csvText.trim().split('\n');
  const records: BankRecord[] = [];

  // Skip header (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const cols = splitCSVLine(line);
    if (cols.length < 10) continue; // Basic validation

    records.push({
      account_no: cols[0],
      settlement_date: cols[1],
      transaction_date: cols[2],
      time: cols[3],
      invoice_number: cols[4],
      product: cols[5],
      liter: parseFloat(cols[6]),
      price: parseFloat(cols[7]),
      amount_before_vat: parseAmount(cols[8]),
      vat: parseAmount(cols[9]),
      total_amount: parseAmount(cols[10]),
      wht_1_percent: parseAmount(cols[11]), // Not strictly needed for logic but good to keep
      total_amount_after_wd: parseAmount(cols[12]),
      merchant_id: cols[13],
      fuel_brand: cols[14] || '',
      raw_date: parseDate(cols[2])
    });
  }
  return records;
};

export const parseBookCSV = (csvText: string): BookRecord[] => {
  const lines = csvText.trim().split('\n');
  const records: BookRecord[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = splitCSVLine(line);
    if (cols.length < 4) continue;

    records.push({
      document_no: cols[0],
      posting_date: cols[1],
      description: cols[2], // Matches invoice_number often
      amount: parseAmount(cols[3]),
      raw_date: parseDate(cols[1])
    });
  }
  return records;
};
