import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { FileText, Check, AlertCircle, Play, Database, FileCheck, RefreshCw, Sparkles, Loader2 } from 'lucide-react';
import { parseBankCSV, parseBookCSV } from './services/csvParser';
import { runReconciliation, calculateSummary } from './services/reconEngine';
import { generateReconAnalysis } from './services/geminiService';
import StatCard from './components/StatCard';
import DetailsTable from './components/DetailsTable';
import { BankRecord, BookRecord, ReconResult, ReconSummary } from './types';

// Sample data for demo purposes
const SAMPLE_BANK_CSV = `account_no,settlement_date,transaction_date,time,invoice_number,product,liter,price,amount_before_vat,vat,total_amount,wht_1_percent,total_amount_after_wd,merchant_id,fuel_brand
123456789,1/9/2025,1/9/2025,19:21:15,395443,DIESEL (PTT),65,32,"1,943.93",136.07,"2,080.00",19.44,"2,060.56",1235001074,PTT
123456789,1/9/2025,1/9/2025,15:01:09,934785,DIESEL (PTT),50,32.12,"1,500.93",105.07,"1,606.00",15.01,"1,590.99",1024261188,PTT
123456789,1/9/2025,1/9/2025,13:45:26,441282,DIESEL (PTT),70.603,32.01,"2,112.15",147.85,"2,260.00",21.12,"2,238.88",1208001468,PTT
123456789,1/9/2025,1/9/2025,12:58:37,641858,HI DIESEL S (BCP),155.67,32.12,"4,672.90",327.1,"5,000.00",46.73,"4,953.27",1068401574,ESSO
123456789,1/9/2025,1/9/2025,10:29:50,585585,HI DIESEL S (BCP),65.81,32.06,"1,971.96",138.04,"2,110.00",19.72,"2,090.28",1235008036,BCP
123456789,2/9/2025,2/9/2025,06:55:53,857576,DIESEL (PTT),162.55,31.99,"4,859.81",340.19,"5,200.00",48.6,"5,151.40",1114970236,PTT
123456789,2/9/2025,2/9/2025,11:12:32,249171,HI DIESEL S (BCP),43.74,32.01,"1,308.41",91.59,"1,400.00",13.08,"1,386.92",1086002228,BCP
123456789,2/9/2025,2/9/2025,16:57:38,813343,DIESEL (PTT),51.794,32.05,"1,551.40",108.6,"1,660.00",15.51,"1,644.49",1067590235,PTT
123456789,2/9/2025,2/9/2025,14:11:10,116663,HI DIESEL S (BCP),262.42,32.01,"7,850.47",549.53,"8,400.00",78.5,"8,321.50",1022880786,ESSO
123456789,2/9/2025,2/9/2025,06:11:20,835972,DIESEL (PTT),146.554,32.07,"4,392.52",307.48,"4,700.00",43.93,"4,656.07",1107090475,PTT`;

const SAMPLE_BOOK_CSV = `document_no,posting_date,description,amount
1,1/9/2025,395443,"2,080.00"
2,1/9/2025,934785,"1,606.00"
3,1/9/2025,441282,"2,260.00"
4,1/9/2025,641858,"5,000.00"
5,1/9/2025,585585,"2,110.00"
6,2/9/2025,857576,"5,044.00"
7,2/9/2025,249171,"1,400.00"
8,2/9/2025,813343,"1,660.00"
9,2/9/2025,116663,"8,400.00"
10,2/9/2025,835972,"4,700.00"`;

const App = () => {
  const [bankData, setBankData] = useState<BankRecord[]>([]);
  const [bookData, setBookData] = useState<BookRecord[]>([]);
  const [results, setResults] = useState<ReconResult[]>([]);
  const [summary, setSummary] = useState<ReconSummary | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [step, setStep] = useState<'upload' | 'dashboard'>('upload');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'bank' | 'book') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (type === 'bank') {
        setBankData(parseBankCSV(text));
      } else {
        setBookData(parseBookCSV(text));
      }
    };
    reader.readAsText(file);
  };

  const loadDemoData = () => {
    setBankData(parseBankCSV(SAMPLE_BANK_CSV));
    setBookData(parseBookCSV(SAMPLE_BOOK_CSV));
  };

  const handleReconcile = async () => {
    if (bankData.length === 0 || bookData.length === 0) return;

    // 1. Run Core Logic
    const reconResults = runReconciliation(bankData, bookData);
    const reconSummary = calculateSummary(reconResults);

    setResults(reconResults);
    setSummary(reconSummary);
    setStep('dashboard');

    // 2. Trigger AI Analysis
    setIsAnalyzing(true);
    try {
      const analysis = await generateReconAnalysis(reconSummary, reconResults);
      setAiAnalysis(analysis);
    } catch (err) {
      console.error(err);
      setAiAnalysis('<p class="text-red-500">Analysis unavailable. Please ensure valid API Key in environment.</p>');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const reset = () => {
    setStep('upload');
    setResults([]);
    setSummary(null);
    setAiAnalysis('');
    setBankData([]);
    setBookData([]);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-12">
      {/* Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <FileCheck className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
                FinRecon AI
              </span>
            </div>
            {step === 'dashboard' && (
              <button 
                onClick={reset}
                className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> New Reconciliation
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {step === 'upload' ? (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-slate-900 mb-4">Automated Financial Reconciliation</h1>
              <p className="text-lg text-slate-600">
                Upload your Bank Statement and GL Book records to instantly match transactions and identify variances using AI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {/* Bank Upload */}
              <div className={`p-8 rounded-2xl border-2 border-dashed transition-all duration-200 ${bankData.length > 0 ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/30'}`}>
                <div className="flex flex-col items-center text-center">
                  {bankData.length > 0 ? (
                    <div className="bg-green-100 p-4 rounded-full mb-4">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                  ) : (
                    <div className="bg-slate-100 p-4 rounded-full mb-4">
                      <Database className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Bank Data (CSV)</h3>
                  <p className="text-sm text-slate-500 mb-6">Upload the bank statement export</p>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={(e) => handleFileUpload(e, 'bank')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${bankData.length > 0 ? 'bg-white text-green-700 border border-green-200 shadow-sm' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                      {bankData.length > 0 ? `${bankData.length} Records Loaded` : 'Select File'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Book Upload */}
              <div className={`p-8 rounded-2xl border-2 border-dashed transition-all duration-200 ${bookData.length > 0 ? 'border-green-500 bg-green-50' : 'border-slate-300 hover:border-indigo-400 bg-white hover:bg-indigo-50/30'}`}>
                <div className="flex flex-col items-center text-center">
                  {bookData.length > 0 ? (
                    <div className="bg-green-100 p-4 rounded-full mb-4">
                      <Check className="w-8 h-8 text-green-600" />
                    </div>
                  ) : (
                    <div className="bg-slate-100 p-4 rounded-full mb-4">
                      <FileText className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">Book Data (CSV)</h3>
                  <p className="text-sm text-slate-500 mb-6">Upload the general ledger export</p>
                  
                  <div className="relative">
                    <input 
                      type="file" 
                      accept=".csv"
                      onChange={(e) => handleFileUpload(e, 'book')}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <button className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${bookData.length > 0 ? 'bg-white text-green-700 border border-green-200 shadow-sm' : 'bg-slate-900 text-white hover:bg-slate-800'}`}>
                      {bookData.length > 0 ? `${bookData.length} Records Loaded` : 'Select File'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4">
              <button 
                onClick={handleReconcile}
                disabled={bankData.length === 0 || bookData.length === 0}
                className="w-full md:w-auto px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
              >
                <Play className="w-5 h-5" /> Run Reconciliation
              </button>
              
              <button 
                onClick={loadDemoData}
                className="text-sm text-slate-500 hover:text-indigo-600 underline"
              >
                Or load sample data to test
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard 
                title="Matched" 
                value={summary?.matchedCount || 0} 
                subtext={`${summary?.matchRate.toFixed(1)}% match rate`}
                icon={Check} 
                color="bg-green-500" 
              />
              <StatCard 
                title="Variances" 
                value={summary?.varianceCount || 0}
                subtext={`Total Diff: ${new Intl.NumberFormat('en-TH', {style:'currency', currency:'THB'}).format(summary?.totalVarianceAmount || 0)}`}
                icon={AlertCircle} 
                color="bg-yellow-500" 
              />
              <StatCard 
                title="Unmatched (Bank)" 
                value={summary?.unmatchedBankCount || 0} 
                subtext="Requires Book entry"
                icon={Database} 
                color="bg-red-500" 
              />
              <StatCard 
                title="Unmatched (Book)" 
                value={summary?.unmatchedBookCount || 0} 
                subtext="Requires verification"
                icon={FileText} 
                color="bg-orange-500" 
              />
            </div>

            {/* AI Analysis Section */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white flex items-center gap-2">
                <div className="bg-indigo-100 p-2 rounded-lg">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
                <h3 className="font-semibold text-slate-800">Financial Insight Report</h3>
              </div>
              <div className="p-6">
                {isAnalyzing ? (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-500 gap-4">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
                    <p className="text-sm font-medium">Gemini 2.5 is analyzing reconciliation patterns and root causes...</p>
                  </div>
                ) : (
                  <div className="animate-in fade-in duration-500">
                    {aiAnalysis ? (
                      <div dangerouslySetInnerHTML={{ __html: aiAnalysis }} />
                    ) : (
                      <p className="text-slate-400 italic text-center py-8">Analysis pending...</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Details Table */}
            <DetailsTable data={results} />
          </div>
        )}
      </main>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);