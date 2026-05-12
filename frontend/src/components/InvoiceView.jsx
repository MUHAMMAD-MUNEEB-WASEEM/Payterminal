import { CreditCard, Printer, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InvoiceView({ invoice, onPay, payingId }) {
  const officeNo = invoice.brandNo || invoice.brand?.brandNo || null;

  const handlePrint = () => window.print();

  const handleCopyLink = async () => {
    const paymentUrl = `${window.location.origin}/pay/${invoice._id}`;
    try {
      await navigator.clipboard.writeText(paymentUrl);
      toast.success('Payment link copied!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const statusColor = {
    pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    paid: 'bg-green-100 text-green-700 border-green-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-6">
      {/* Invoice Document */}
      <div id="invoice-print" className="border border-gray-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white px-8 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-wide">INVOICE</h1>
              <p className="text-blue-200 text-sm mt-1">
                {invoice.brand?.name} - Office # {officeNo || 'N/A'}
              </p>
            </div>
            <div className="text-right">
              {invoice.brand?.logo && (
                <img
                  src={`http://localhost:5000${invoice.brand.logo}`}
                  alt={invoice.brand.name}
                  className="w-16 h-16 rounded-lg object-cover border-2 border-white/30 mb-2 ml-auto"
                />
              )}
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${statusColor[invoice.status]} bg-white/10 border-white/20 text-white`}>
                {invoice.status?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        {/* Invoice Meta */}
        <div className="bg-blue-50 px-8 py-4 border-b border-gray-200">
          <div className="flex flex-wrap gap-6 mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Invoice Number</p>
              <p className="font-mono font-bold text-gray-900 mt-0.5">{invoice.invoiceNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Brand</p>
              <p className="font-semibold text-gray-900 mt-0.5">{invoice.brand?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Date</p>
              <p className="font-medium text-gray-900 mt-0.5">{new Date(invoice.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
          </div>
          {(invoice.customerName || invoice.customerEmail || invoice.customerSerialNumber) && (
            <div className="border-t border-blue-200 pt-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Customer Information</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {invoice.customerName && (
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="font-medium text-gray-900 text-sm">{invoice.customerName}</p>
                  </div>
                )}
                {invoice.customerEmail && (
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="font-medium text-gray-900 text-sm">{invoice.customerEmail}</p>
                  </div>
                )}
                {invoice.customerSerialNumber && (
                  <div>
                    <p className="text-xs text-gray-500">Serial Number</p>
                    <p className="font-medium text-gray-900 text-sm">{invoice.customerSerialNumber}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="px-8 py-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">#</th>
                <th className="text-left py-2 text-gray-500 font-medium">Description</th>
                <th className="text-right py-2 text-gray-500 font-medium">Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items?.map((item, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-3 text-gray-400">{i + 1}</td>
                  <td className="py-3 text-gray-800">{item.description}</td>
                  <td className="py-3 text-right font-medium text-gray-900">{Number(item.amount).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="mt-4 flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal</span>
                <span>USD ${invoice.subtotal?.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-gray-200 pt-2 text-gray-900">
                <span>Total</span>
                <span className="text-blue-700">USD ${invoice.total?.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200 text-center">
          <p className="text-xs text-gray-400">Thank you for your business. This invoice was generated by PayTerminal.</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
          <Printer size={15} /> Print
        </button>
        {invoice.status === 'pending' && (
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <LinkIcon size={15} />
            Copy Payment Link
          </button>
        )}
      </div>
    </div>
  );
}
