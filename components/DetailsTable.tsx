import React, { useState } from 'react';
import { ReconResult, MatchStatus } from '../types';
import { CheckCircle, AlertTriangle, XCircle, Search, Sparkles } from 'lucide-react';

interface DetailsTableProps {
  data: ReconResult[];
}

const DetailsTable: React.FC<DetailsTableProps> = ({ data }) => {
  const [filter, setFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const filteredData = data.filter(item => {
    const matchesFilter = filter === 'ALL' || item.status === filter;
    const matchesSearch = 
      (item.bankRecord?.invoice_number?.includes(search) ?? false) ||
      (item.bookRecord?.description?.includes(search) ?? false) ||
      (item.bookRecord?.document_no?.includes(search) ?? false);
    return matchesFilter && matchesSearch;
  });

  const formatCurrency = (val?: number) => {
    if (val === undefined) return '-';
    return new Intl.NumberFormat('en-TH', { style: 'currency', currency: 'THB' }).format(val);
  };

  const getStatusBadge = (status: MatchStatus) => {
    switch (status) {
      case MatchStatus.MATCHED:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1"/> Matched</span>;
      case MatchStatus.VARIANCE:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><AlertTriangle className="w-3 h-3 mr-1"/> Variance</span>;
      case MatchStatus.UNMATCHED_BANK:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="w-3 h-3 mr-1"/> Unmatched (Bank)</span>;
      case MatchStatus.UNMATCHED_BOOK:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800"><XCircle className="w-3 h-3 mr-1"/> Unmatched (Book)</span>;
      default:
        return <span>{status}</span>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-slate-800">Transaction Details</h2>
        
        <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Search invoice/desc..." 
                    className="pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full sm:w-64"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            <select 
                className="py-2 pl-3 pr-8 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
            >
                <option value="ALL">All Statuses</option>
                <option value={MatchStatus.MATCHED}>Matched</option>
                <option value={MatchStatus.VARIANCE}>Variance</option>
                <option value={MatchStatus.UNMATCHED_BANK}>Unmatched Bank</option>
                <option value={MatchStatus.UNMATCHED_BOOK}>Unmatched Book</option>
            </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Bank Record</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Bank Amt</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Book Record</th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Book Amt</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">AI Suggestion</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredData.map((row) => (
              <tr key={row.id} className={`hover:bg-slate-50 transition-colors ${row.smartFix ? 'bg-indigo-50/30' : ''}`}>
                <td className="px-6 py-4 whitespace-nowrap">{getStatusBadge(row.status)}</td>
                
                {/* Bank Details */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {row.bankRecord ? (
                    <div>
                      <div className="text-sm font-medium text-slate-900">{row.bankRecord.invoice_number}</div>
                      <div className="text-xs text-slate-500">{row.bankRecord.transaction_date}</div>
                    </div>
                  ) : <span className="text-xs text-slate-400 italic">No Record</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                  {formatCurrency(row.bankRecord?.total_amount)}
                </td>

                {/* Book Details */}
                <td className="px-6 py-4 whitespace-nowrap">
                  {row.bookRecord ? (
                    <div>
                      <div className="text-sm font-medium text-slate-900">{row.bookRecord.document_no}</div>
                      <div className="text-xs text-slate-500" title={row.bookRecord.description}>{row.bookRecord.posting_date}</div>
                    </div>
                  ) : <span className="text-xs text-slate-400 italic">No Record</span>}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-900">
                  {formatCurrency(row.bookRecord?.amount)}
                </td>

                {/* AI Suggestion */}
                <td className="px-6 py-4">
                  {row.smartFix ? (
                    <div className="flex items-start gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
                      <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs font-semibold text-indigo-700">{row.smartFix.type}</p>
                        <p className="text-xs text-indigo-600 mt-0.5">{row.smartFix.message}</p>
                      </div>
                    </div>
                  ) : (
                    row.amountDifference !== 0 && (
                      <span className={`text-xs font-medium ${row.amountDifference > 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        Diff: {formatCurrency(row.amountDifference)}
                      </span>
                    )
                  )}
                  {!row.smartFix && row.amountDifference === 0 && <span className="text-xs text-slate-400">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredData.length === 0 && (
            <div className="p-12 text-center text-slate-500">
                <p>No records found.</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default DetailsTable;