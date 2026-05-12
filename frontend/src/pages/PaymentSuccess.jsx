import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { CheckCircle, XCircle, Loader } from 'lucide-react';

export default function PaymentSuccess() {
  const [params] = useSearchParams();
  const invoiceId = params.get('invoice');
  const [status, setStatus] = useState('loading');
  const [invoice, setInvoice] = useState(null);

  useEffect(() => {
    if (!invoiceId) { setStatus('error'); return; }
    const check = async () => {
      try {
        const res = await api.get(`/invoices/${invoiceId}/status`);
        setInvoice(res.data.invoice);
        setStatus(res.data.status);
        
        // Auto-redirect to USPTO.gov after 3 seconds if paid
        if (res.data.status === 'paid') {
          setTimeout(() => {
            window.location.href = 'https://www.uspto.gov';
          }, 3000);
        }
      } catch {
        setStatus('error');
      }
    };
    check();
  }, [invoiceId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-2xl">US</span>
        </div>
        <h1 className="text-xl font-bold text-gray-900 mb-6">USPTO Payment</h1>

        {status === 'loading' && (
          <div className="space-y-3">
            <Loader size={40} className="mx-auto text-blue-500 animate-spin" />
            <p className="text-gray-500">Verifying payment...</p>
          </div>
        )}

        {status === 'paid' && (
          <div className="space-y-4">
            <CheckCircle size={56} className="mx-auto text-green-500" />
            <h2 className="text-xl font-bold text-green-700">Payment Successful!</h2>
            {invoice && (
              <div className="bg-green-50 rounded-lg p-4 text-left space-y-1">
                <p className="text-sm text-gray-600">Invoice: <span className="font-mono font-bold">{invoice.invoiceNumber}</span></p>
                <p className="text-sm text-gray-600">Amount: <span className="font-bold">USD ${invoice.total?.toFixed(2)}</span></p>
              </div>
            )}
            <p className="text-gray-500 text-sm">Your payment has been processed successfully.</p>
            <p className="text-gray-400 text-xs mt-2">Redirecting to USPTO.gov in 3 seconds...</p>
          </div>
        )}

        {(status === 'pending' || status === 'failed' || status === 'error') && (
          <div className="space-y-4">
            <XCircle size={56} className="mx-auto text-red-400" />
            <h2 className="text-xl font-bold text-gray-700">
              {status === 'failed' ? 'Payment Failed' : status === 'pending' ? 'Payment Pending' : 'Something went wrong'}
            </h2>
            <p className="text-gray-500 text-sm">
              {status === 'pending' ? 'Your payment is still being processed.' : 'Please try again or contact support.'}
            </p>
          </div>
        )}

        <Link to="/dashboard" className="mt-6 inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors">
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
