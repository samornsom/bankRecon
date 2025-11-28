import { GoogleGenAI } from "@google/genai";
import { ReconResult, ReconSummary, FixType } from "../types";

export const generateReconAnalysis = async (
  summary: ReconSummary,
  results: ReconResult[]
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key not found");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // 1. Pre-calculate specific error trends for the AI
  const unmatchedItems = results.filter(i => i.status !== 'MATCHED');
  
  const stats = {
    transpositions: unmatchedItems.filter(i => i.smartFix?.type === FixType.TRANSPOSED_DIGITS).length,
    scaling: unmatchedItems.filter(i => i.smartFix?.type === FixType.SCALING_ERROR).length,
    typos: unmatchedItems.filter(i => i.smartFix?.type === FixType.ID_TYPO).length,
    timing: unmatchedItems.filter(i => i.smartFix?.type === FixType.TIMING_DIFF).length,
  };

  const totalSmartFixes = stats.transpositions + stats.scaling + stats.typos + stats.timing;

  // Prepare detailed list for context
  const criticalItems = unmatchedItems
    .slice(0, 15)
    .map(i => {
      const fixMsg = i.smartFix ? `[AI Detect: ${i.smartFix.type} - ${i.smartFix.message}]` : '';
      if (i.status === 'VARIANCE') {
        return `- Variance: Inv ${i.bankRecord?.invoice_number} (Bank: ${i.bankRecord?.total_amount}, Book: ${i.bookRecord?.amount}). Diff: ${i.amountDifference.toFixed(2)}. ${fixMsg}`;
      }
      if (i.status === 'UNMATCHED_BANK') {
        return `- Orphan Bank: Inv ${i.bankRecord?.invoice_number}, Amt ${i.bankRecord?.total_amount}. ${fixMsg}`;
      }
      return `- Orphan Book: Doc ${i.bookRecord?.document_no}, Amt ${i.bookRecord?.amount}. ${fixMsg}`;
    })
    .join('\n');

  const prompt = `
    You are a Senior Financial Controller AI. Your goal is to generate a comprehensive, dashboard-style HTML report analyzing the reconciliation results.
    
    **Data Context:**
    - Match Rate: ${summary.matchRate.toFixed(1)}% (${summary.matchedCount} items)
    - Total Variance Amount: ${summary.totalVarianceAmount.toLocaleString()}
    - Unmatched Bank: ${summary.unmatchedBankCount}
    - Unmatched Book: ${summary.unmatchedBookCount}
    
    **AI Detected Anomalies (Smart Fixes):**
    - Potential Transposition Errors: ${stats.transpositions}
    - Potential Scaling/Decimal Errors: ${stats.scaling}
    - Potential ID Typos: ${stats.typos}
    - Total Actionable Fixes Identified: ${totalSmartFixes}

    **Sample Exceptions:**
    ${criticalItems}

    **Instructions:**
    1. Generate a raw **HTML** snippet (no \`\`\`html tags, just the inner HTML).
    2. Use **Tailwind CSS** classes for styling. The background is white. Use 'indigo', 'emerald', 'amber', 'rose', 'slate' color palettes.
    3. Structure:
       - **Executive Summary Box**: A high-level assessment of the financial data health.
       - **Error Trend Grid**: A 2-column grid showing the breakdown of error types (e.g., "Human Error Detected: X cases of transposed digits").
       - **Root Cause Analysis**: Why are these errors happening? (e.g., manual entry fatigue, system sync timing).
       - **Strategic Recommendations**: Bullet points on how to improve the process (e.g., implement OCR, training on data entry).
       - **AI Learning**: A brief note on what the AI has learned from this dataset to improve future matching.
    4. Make it look like a professional dashboard report. Use icons (using simple SVG or just emojis if easier) and badges.
    
    **Tone:** Professional, analytical, insightful, and constructive.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    let text = response.text || "<p>Analysis unavailable.</p>";
    // Cleanup any markdown code fences if Gemini adds them
    text = text.replace(/^```html/, '').replace(/```$/, '');
    return text;

  } catch (error) {
    console.error("Gemini API Error:", error);
    return `<div class="p-4 bg-red-50 text-red-700 rounded-lg">Error generating analysis: ${(error as Error).message}</div>`;
  }
};
