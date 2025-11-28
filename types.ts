export interface BankRecord {
  account_no: string;
  settlement_date: string;
  transaction_date: string;
  time: string;
  invoice_number: string;
  product: string;
  liter: number;
  price: number;
  amount_before_vat: number;
  vat: number;
  total_amount: number;
  wht_1_percent: number;
  total_amount_after_wd: number;
  merchant_id: string;
  fuel_brand: string;
  raw_date: Date; // Parsed Date object
}

export interface BookRecord {
  document_no: string;
  posting_date: string;
  description: string;
  amount: number;
  raw_date: Date; // Parsed Date object
}

export enum MatchStatus {
  MATCHED = 'MATCHED',
  VARIANCE = 'VARIANCE', // Matched on ID but amount differs
  UNMATCHED_BANK = 'UNMATCHED_BANK',
  UNMATCHED_BOOK = 'UNMATCHED_BOOK',
}

export enum FixType {
  TRANSPOSED_DIGITS = 'TRANSPOSED_DIGITS', // 54 vs 45
  SCALING_ERROR = 'SCALING_ERROR', // 100 vs 1000
  ID_TYPO = 'ID_TYPO', // INV-01 vs INV-0l
  TIMING_DIFF = 'TIMING_DIFF', // Date mismatch
  UNKNOWN = 'UNKNOWN'
}

export interface SmartFix {
  suggestedRecord?: BankRecord; // The bank record we think matches this book record
  message: string;
  confidence: number; // 0 to 100
  type: FixType;
}

export interface ReconResult {
  id: string; // generated UUID for key
  bankRecord?: BankRecord;
  bookRecord?: BookRecord;
  status: MatchStatus;
  amountDifference: number;
  notes?: string;
  smartFix?: SmartFix; // AI Suggestion
}

export interface ReconSummary {
  totalBank: number;
  totalBook: number;
  matchedCount: number;
  varianceCount: number;
  unmatchedBankCount: number;
  unmatchedBookCount: number;
  matchRate: number;
  totalVarianceAmount: number;
}