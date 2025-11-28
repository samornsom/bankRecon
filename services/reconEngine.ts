import { BankRecord, BookRecord, MatchStatus, ReconResult, SmartFix, FixType, ReconSummary } from '../types';

// Helper to calculate Levenshtein distance for typos
const getLevenshteinDistance = (a: string, b: string): number => {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
};

// Check if two numbers are transpositions of each other (e.g. 540 and 450)
// Simplified check: difference is divisible by 9 and usually close in range
const isPotentialTransposition = (amount1: number, amount2: number): boolean => {
    const diff = Math.abs(amount1 - amount2);
    // Standard accounting rule: Transposition errors are divisible by 9
    if (diff === 0) return false;
    // Check if diff is divisible by 9 (or 0.9, 0.09 for decimals)
    // and ensuring amounts are somewhat similar strings (anagrams)
    if (diff % 0.09 < 0.001 || diff % 0.9 < 0.001 || diff % 9 === 0) {
       // Convert to string and sort digits to see if they are anagrams
       const s1 = amount1.toFixed(2).replace('.', '').split('').sort().join('');
       const s2 = amount2.toFixed(2).replace('.', '').split('').sort().join('');
       return s1 === s2;
    }
    return false;
};

const applySmartFixes = (results: ReconResult[], unmatchedBankRecords: BankRecord[]): ReconResult[] => {
    return results.map(res => {
        // Only look for fixes on unmatched BOOK records or Variances
        if (res.status !== MatchStatus.UNMATCHED_BOOK && res.status !== MatchStatus.VARIANCE) {
            return res;
        }

        const book = res.bookRecord;
        if (!book) return res;

        let bestFix: SmartFix | undefined = undefined;

        // 1. If it's a VARIANCE, we already have the Bank Record. Check why it varies.
        if (res.status === MatchStatus.VARIANCE && res.bankRecord) {
            const bankAmt = res.bankRecord.total_amount;
            const bookAmt = book.amount;
            
            if (isPotentialTransposition(bankAmt, bookAmt)) {
                bestFix = {
                    message: `Possible Transposed Digits. Correct amount likely ${bankAmt}.`,
                    confidence: 90,
                    type: FixType.TRANSPOSED_DIGITS,
                    suggestedRecord: res.bankRecord
                };
            } else if (Math.abs(bankAmt - bookAmt * 10) < 0.01 || Math.abs(bankAmt - bookAmt / 10) < 0.01) {
                 bestFix = {
                    message: `Possible Decimal/Scaling Error.`,
                    confidence: 85,
                    type: FixType.SCALING_ERROR,
                    suggestedRecord: res.bankRecord
                };
            }
        } 
        // 2. If it's UNMATCHED_BOOK, scan through UNMATCHED_BANK records for candidates
        else if (res.status === MatchStatus.UNMATCHED_BOOK) {
            for (const bankItem of unmatchedBankRecords) {
                let currentFix: SmartFix | undefined;

                // Check A: ID Typo (Fuzzy ID Match)
                const dist = getLevenshteinDistance(book.description, bankItem.invoice_number);
                // Allow small typos (e.g. distance 1 or 2 depending on length)
                const maxDist = book.description.length > 5 ? 2 : 1;
                
                if (dist > 0 && dist <= maxDist && Math.abs(book.amount - bankItem.total_amount) < 0.01) {
                    currentFix = {
                        message: `Typo in Invoice ID detected (Found: ${bankItem.invoice_number}).`,
                        confidence: 85,
                        type: FixType.ID_TYPO,
                        suggestedRecord: bankItem
                    };
                }

                // Check B: Transposition (Same ID/Date but Amount Transposed)
                // Note: If ID matched exactly, it would be VARIANCE. So this is for fuzzy ID OR fuzzy Date + Transposition
                else if (isPotentialTransposition(book.amount, bankItem.total_amount)) {
                    // Check date proximity (within 2 days)
                    const dayDiff = Math.abs(book.raw_date.getTime() - bankItem.raw_date.getTime()) / (1000 * 3600 * 24);
                    if (dayDiff <= 2) {
                        currentFix = {
                            message: `Amount mismatch (Transposed Digits?) found near date.`,
                            confidence: 75,
                            type: FixType.TRANSPOSED_DIGITS,
                            suggestedRecord: bankItem
                        };
                    }
                }

                // Check C: Scaling Error (e.g. 100 vs 1000)
                else if (Math.abs(bankItem.total_amount - book.amount * 10) < 0.01 || Math.abs(bankItem.total_amount - book.amount / 10) < 0.01) {
                     const dayDiff = Math.abs(book.raw_date.getTime() - bankItem.raw_date.getTime()) / (1000 * 3600 * 24);
                     if (dayDiff <= 2) {
                        currentFix = {
                            message: `Possible Decimal Point Error.`,
                            confidence: 80,
                            type: FixType.SCALING_ERROR,
                            suggestedRecord: bankItem
                        };
                     }
                }

                // Logic to keep the BEST fix found so far for this book record
                if (currentFix) {
                    if (!bestFix || currentFix.confidence > bestFix.confidence) {
                        bestFix = currentFix;
                    }
                }
            }
        }

        if (bestFix) {
            return { ...res, smartFix: bestFix };
        }
        return res;
    });
};

export const runReconciliation = (bankData: BankRecord[], bookData: BookRecord[]): ReconResult[] => {
  let results: ReconResult[] = [];
  const matchedBookIndices = new Set<number>();
  const matchedBankIndices = new Set<number>();
  
  // 1. Exact Match Strategy: Invoice Number (Bank) === Description (Book)
  bankData.forEach((bankItem, bankIdx) => {
    // Search in Book Data
    const bookIndex = bookData.findIndex((bookItem, idx) => {
      if (matchedBookIndices.has(idx)) return false;
      return bookItem.description === bankItem.invoice_number;
    });

    if (bookIndex !== -1) {
      matchedBookIndices.add(bookIndex);
      matchedBankIndices.add(bankIdx);
      const matchedBook = bookData[bookIndex];

      let status = MatchStatus.MATCHED;
      let diff = 0;

      // Check Amount
      if (Math.abs(matchedBook.amount - bankItem.total_amount) < 0.01) {
        status = MatchStatus.MATCHED;
      } else {
        status = MatchStatus.VARIANCE;
        diff = matchedBook.amount - bankItem.total_amount;
      }

      results.push({
        id: crypto.randomUUID(),
        bankRecord: bankItem,
        bookRecord: matchedBook,
        status: status,
        amountDifference: diff
      });
    }
  });

  // 2. Fuzzy Strategy: Exact Amount AND Exact Date (when ID is missing/wrong)
  bankData.forEach((bankItem, bankIdx) => {
      if (matchedBankIndices.has(bankIdx)) return;

        const bookIndex = bookData.findIndex((bookItem, idx) => {
            if (matchedBookIndices.has(idx)) return false;
            const dateMatch = bookItem.raw_date.getTime() === bankItem.raw_date.getTime();
            const amountMatch = Math.abs(bookItem.amount - bankItem.total_amount) < 0.01;
            return dateMatch && amountMatch;
        });

        if (bookIndex !== -1) {
            matchedBookIndices.add(bookIndex);
            matchedBankIndices.add(bankIdx);
            results.push({
                id: crypto.randomUUID(),
                bankRecord: bankItem,
                bookRecord: bookData[bookIndex],
                status: MatchStatus.MATCHED, // Inferred Match
                amountDifference: 0,
                notes: 'Inferred match by Date & Amount'
            });
        }
  });

  // 3. Identify Unmatched Bank
  bankData.forEach((bankItem, idx) => {
    if (!matchedBankIndices.has(idx)) {
      results.push({
        id: crypto.randomUUID(),
        bankRecord: bankItem,
        status: MatchStatus.UNMATCHED_BANK,
        amountDifference: bankItem.total_amount
      });
    }
  });

  // 4. Identify Unmatched Book
  bookData.forEach((bookItem, idx) => {
    if (!matchedBookIndices.has(idx)) {
      results.push({
        id: crypto.randomUUID(),
        bookRecord: bookItem,
        status: MatchStatus.UNMATCHED_BOOK,
        amountDifference: -bookItem.amount
      });
    }
  });

  // 5. Apply Smart Fixes
  const unmatchedBankRecords = results
    .filter(r => r.status === MatchStatus.UNMATCHED_BANK && r.bankRecord)
    .map(r => r.bankRecord!);
    
  results = applySmartFixes(results, unmatchedBankRecords);

  return results;
};

export const calculateSummary = (results: ReconResult[]): ReconSummary => {
  const totalBank = results.filter(r => r.bankRecord).length;
  const totalBook = results.filter(r => r.bookRecord).length;
  
  const matchedCount = results.filter(r => r.status === MatchStatus.MATCHED).length;
  const varianceCount = results.filter(r => r.status === MatchStatus.VARIANCE).length;
  const unmatchedBankCount = results.filter(r => r.status === MatchStatus.UNMATCHED_BANK).length;
  const unmatchedBookCount = results.filter(r => r.status === MatchStatus.UNMATCHED_BOOK).length;

  const totalVarianceAmount = results
    .filter(r => r.status === MatchStatus.VARIANCE)
    .reduce((sum, r) => sum + Math.abs(r.amountDifference), 0);

  const totalItems = totalBank + totalBook; // Approximate simple denominator
  // Or match rate based on transactions processed
  const matchRate = totalItems > 0 ? ((matchedCount * 2) / totalItems) * 100 : 0;

  return {
    totalBank,
    totalBook,
    matchedCount,
    varianceCount,
    unmatchedBankCount,
    unmatchedBookCount,
    matchRate,
    totalVarianceAmount
  };
};