import { useEffect, useState } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import InvoiceView from '../components/InvoiceView';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Plus, Eye, Trash2, Link as LinkIcon, FileText, RefreshCw, CheckCircle, AlertCircle, Undo2, User, MapPin, CreditCard } from 'lucide-react';

const EMPTY_FORM = { 
  brandId: '', 
  items: [{ description: '', amount: '' }], 
  customerEmail: '',
  customerName: '',
  customerSerialNumber: ''
};

export default function Invoices() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [viewInvoice, setViewInvoice] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refundModal, setRefundModal] = useState(null);
  const [chargebackModal, setChargebackModal] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [chargebackAmount, setChargebackAmount] = useState('');
  const [billingDetailsModal, setBillingDetailsModal] = useState(null);
  const [billingDetails, setBillingDetails] = useState(null);
  const [loadingBillingDetails, setLoadingBillingDetails] = useState(false);

  const fetchAll = async () => {
    try {
      const invRes = await api.get('/invoices');
      // Fetch brands based on user role
      const brandRes = user?.role === 'admin' 
        ? await api.get('/brands')
        : await api.get('/user-brands/my-brands');
      
      setInvoices(invRes.data);
      setBrands(brandRes.data);
    } catch {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const addItem = () => setForm({ ...form, items: [...form.items, { description: '', amount: '' }] });
  const removeItem = (i) => setForm({ ...form, items: form.items.filter((_, idx) => idx !== i) });
  const updateItem = (i, field, value) => {
    const items = [...form.items];
    if (field === 'amount') {
      // Debug: log what's being set
      console.log(`Setting amount[${i}] to:`, value, 'Type:', typeof value);
    }
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  };

  const total = form.items.reduce((s, item) => {
    let amount = parseFloat(item.amount) || 0;
    // If amount appears to be in cents (if it's > 100 and looks like cents), convert to dollars
    if (amount > 100 && form.items.length > 0 && item.amount) {
      // Check if this might be a cents value (e.g., user meant $5 but it shows as 500)
      const itemStr = String(item.amount);
      if (itemStr.length === 3 && itemStr.endsWith('00')) {
        amount = amount / 100;
      }
    }
    return s + amount;
  }, 0);
  
  const [ticketSizeError, setTicketSizeError] = useState(null);
  
  // Check ticket size when brand or total changes
  useEffect(() => {
    if (!form.brandId || total <= 0) {
      setTicketSizeError(null);
      return;
    }
    
    // Find merchants for this brand and check ticket sizes
    const selectedBrand = brands.find(b => b._id === form.brandId);
    if (!selectedBrand) {
      setTicketSizeError(null);
      return;
    }
    
    // Check if invoice total exceeds any merchant's ticket size
    const checkTicketSizes = async () => {
      try {
        const res = await api.get(`/merchants/brand/${form.brandId}`);
        const merchants = res.data;
        
        for (const merchant of merchants) {
          // Only check if ticket size is set (optional field)
          if (merchant.ticketSize && merchant.ticketSize > 0 && total >= merchant.ticketSize) {
            setTicketSizeError({
              merchantName: merchant.nickname,
              ticketSize: merchant.ticketSize,
              currentTotal: total
            });
            return;
          }
        }
        setTicketSizeError(null);
      } catch (err) {
        console.error('Error checking ticket size:', err);
        setTicketSizeError(null);
      }
    };
    
    checkTicketSizes();
  }, [total, form.brandId, brands]);

  const handleCreate = async (e) => {
    e.preventDefault();
    const validItems = form.items.filter(i => i.description && i.amount);
    if (!form.brandId) return toast.error('Select a brand');
    if (validItems.length === 0) return toast.error('Add at least one item');
    if (!form.customerName) return toast.error('Customer name is required');
    if (!form.customerEmail) return toast.error('Customer email is required');
    if (!form.customerSerialNumber) return toast.error('Customer serial number is required');
    
    // Check ticket size violation
    if (ticketSizeError) {
      return toast.error(`Invoice total ($${ticketSizeError.currentTotal.toFixed(2)}) exceeds ticket size limit ($${ticketSizeError.ticketSize.toFixed(2)}) for ${ticketSizeError.merchantName}`);
    }
    
    // Debug: Log what we're sending
    console.log('=== INVOICE CREATION DEBUG ===');
    console.log('Items being sent:', JSON.stringify(validItems, null, 2));
    const calculatedTotal = validItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    console.log('Calculated total:', calculatedTotal);
    console.log('Form total:', total);
    
    setSaving(true);
    try {
      await api.post('/invoices', { ...form, items: validItems });
      toast.success('Invoice created');
      setShowCreate(false);
      setForm(EMPTY_FORM);
      setTicketSizeError(null);
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create invoice');
    } finally {
      setSaving(false);
    }
  };

  const handlePay = async (invoice) => {
    const paymentUrl = `${window.location.origin}/pay/${invoice._id}`;
    try {
      await navigator.clipboard.writeText(paymentUrl);
      toast.success('Payment link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleCheckStatus = async (invoice) => {
    try {
      const res = await api.get(`/invoices/${invoice._id}/status`);
      toast.success(`Status: ${res.data.status}`);
      fetchAll();
    } catch {
      toast.error('Failed to check status');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this invoice?')) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success('Invoice deleted');
      fetchAll();
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleReverse = async (invoiceId) => {
    if (!confirm('Are you sure you want to reverse this payment? This will mark the invoice as reversed and adjust merchant processed amounts.')) {
      return;
    }
    
    try {
      await api.patch(`/invoices/${invoiceId}/reverse`);
      toast.success('Payment reversed successfully');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reverse payment');
    }
  };

  const handleUndo = async (invoiceId) => {
    if (!confirm('Are you sure you want to undo this payment? This will change the invoice back to pending status.')) {
      return;
    }
    
    try {
      await api.patch(`/invoices/${invoiceId}/undo`);
      toast.success('Payment undone successfully - invoice is now pending');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to undo payment');
    }
  };

  const handleRefund = async (invoice) => {
    if (!refundAmount || parseFloat(refundAmount) <= 0) {
      toast.error('Enter a valid refund amount');
      return;
    }
    if (parseFloat(refundAmount) > invoice.total) {
      toast.error('Refund amount cannot exceed invoice total');
      return;
    }
    try {
      await api.patch(`/invoices/${invoice._id}/refund`, { refundAmount: parseFloat(refundAmount) });
      toast.success('Invoice marked as refunded');
      setRefundModal(null);
      setRefundAmount('');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to refund invoice');
    }
  };

  const handleChargeback = async (invoice) => {
    if (!chargebackAmount || parseFloat(chargebackAmount) <= 0) {
      toast.error('Enter a valid chargeback amount');
      return;
    }
    if (parseFloat(chargebackAmount) > invoice.total) {
      toast.error('Chargeback amount cannot exceed invoice total');
      return;
    }
    try {
      await api.patch(`/invoices/${invoice._id}/chargeback`, { chargebackAmount: parseFloat(chargebackAmount) });
      toast.success('Invoice marked as chargebacked');
      setChargebackModal(null);
      setChargebackAmount('');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark invoice as chargebacked');
    }
  };

  const handleViewBillingDetails = async (invoiceId) => {
    setLoadingBillingDetails(true);
    try {
      console.log('📋 Fetching billing details for invoice:', invoiceId);
      const res = await api.get(`/invoices/${invoiceId}/billing`);
      console.log('✅ Billing details response:', res.data);
      setBillingDetails(res.data);
      setBillingDetailsModal(true);
    } catch (err) {
      console.error('❌ Error fetching billing details:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      toast.error(err.response?.data?.message || 'Failed to load billing details');
    } finally {
      setLoadingBillingDetails(false);
    }
  };

  const statusBadge = (status, refundAmount, chargebackAmount) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-700',
      paid: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      refunded: 'bg-red-100 text-red-700',
      chargebacked: 'bg-orange-100 text-orange-700'
    };
    
    const label = status === 'refunded' ? `Refunded ($${(refundAmount || 0).toFixed(2)})` :
                   status === 'chargebacked' ? `Chargeback ($${(chargebackAmount || 0).toFixed(2)})` : status;
    
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || ''}`}>{label}</span>;
  };

  // Filter invoices based on search term
  const filteredInvoices = invoices.filter(inv => 
    (inv.invoiceNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (inv.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">{filteredInvoices.length} of {invoices.length} invoice{invoices.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchAll} className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <RefreshCw size={16} /> Refresh
          </button>
          <button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> New Invoice
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <input
          type="text"
          placeholder="Search by invoice number or customer name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Invoice #</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Customer</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Brand</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Office #</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Total</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Link</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                  <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                  {searchTerm ? 'No invoices match your search' : 'No invoices yet'}
                </td></tr>
              ) : filteredInvoices.map(inv => (
                <tr key={inv._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono font-medium text-blue-600">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4 text-gray-700">{inv.customerName || '—'}</td>
                  <td className="px-6 py-4 text-gray-700">{inv.brand?.name || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{inv.brandNo || (<span className="text-gray-400 italic">N/A</span>)}</td>
                  <td className="px-6 py-4 font-semibold">USD ${inv.total?.toFixed(2)}</td>
                  <td className="px-6 py-4">{statusBadge(inv.status, inv.refundAmount, inv.chargebackAmount)}</td>
                  <td className="px-6 py-4">
                    {inv.linkOpenedAt ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                        ✓ Opened
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        Not opened
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setViewInvoice(inv)} title="View" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                        <Eye size={15} />
                      </button>
                      {inv.status === 'pending' && (
                        <button onClick={() => handlePay(inv)} title="Copy Payment Link" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                          <LinkIcon size={15} />
                        </button>
                      )}
                      {inv.status === 'paid' && (
                        <>
                          <span className="p-1.5 text-green-600" title="Paid">
                            <CheckCircle size={15} />
                          </span>
                          <button 
                            onClick={() => handleViewBillingDetails(inv._id)} 
                            title="View Customer Details" 
                            className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"
                          >
                            <User size={15} />
                          </button>
                          {user?.role === 'admin' && (
                            <>
                              <button 
                                onClick={() => handleUndo(inv._id)} 
                                title="Undo Payment (Back to Pending)" 
                                className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600 transition-colors"
                              >
                                <Undo2 size={15} />
                              </button>
                              <button 
                                onClick={() => handleReverse(inv._id)} 
                                title="Reverse Payment" 
                                className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                              >
                                <RefreshCw size={15} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                      {inv.status === 'reversed' && (
                        <span className="p-1.5 text-blue-600" title="Reversed">
                          <RefreshCw size={15} />
                        </span>
                      )}
                      {user?.role === 'admin' && ['paid', 'refunded', 'chargebacked'].includes(inv.status) && (
                        <>
                          <button onClick={() => { setRefundModal(inv); setRefundAmount(inv.total); }} title="Refund" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors">
                            <AlertCircle size={15} />
                          </button>
                          <button onClick={() => { setChargebackModal(inv); setChargebackAmount(inv.total); }} title="Chargeback" className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-600 transition-colors">
                            <AlertCircle size={15} />
                          </button>
                        </>
                      )}
                      <button onClick={() => handleDelete(inv._id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Modal */}
      <Modal isOpen={showCreate} title="New Invoice" onClose={() => setShowCreate(false)} size="lg">
        <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand <span className="text-red-500">*</span></label>
              <select
                required value={form.brandId}
                onChange={e => setForm({ ...form, brandId: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a brand</option>
                {brands.map(b => (
                  <option key={b._id} value={b._id}>{b.name} {b.brandNo ? `(#${b.brandNo})` : ''}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                <input
                  type="text" required value={form.customerName}
                  onChange={e => setForm({ ...form, customerName: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Email <span className="text-red-500">*</span></label>
                <input
                  type="email" required value={form.customerEmail}
                  onChange={e => setForm({ ...form, customerEmail: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="customer@email.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Serial Number <span className="text-red-500">*</span></label>
              <input
                type="text" required value={form.customerSerialNumber}
                onChange={e => setForm({ ...form, customerSerialNumber: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., SN-123456"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700">Description Items <span className="text-red-500">*</span></label>
                <button type="button" onClick={addItem} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium">
                  <Plus size={14} /> Add Item
                </button>
              </div>
              <div className="space-y-2">
                {form.items.map((item, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text" placeholder="Description" value={item.description}
                      onChange={e => updateItem(i, 'description', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="number" placeholder="Amount" value={item.amount} min="0" step="0.01"
                      onChange={e => updateItem(i, 'amount', e.target.value)}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {form.items.length > 1 && (
                      <button type="button" onClick={() => removeItem(i)} className="p-2 text-red-400 hover:text-red-600">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg px-4 py-3 flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total Amount</span>
              <span className="text-lg font-bold text-blue-700">USD ${total.toFixed(2)}</span>
            </div>
            
            {/* Ticket Size Warning */}
            {ticketSizeError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
                <p className="text-sm text-red-700">
                  <span className="font-semibold">⚠️ Ticket Size Limit Exceeded</span>
                </p>
                <p className="text-sm text-red-600 mt-1">
                  Invoice total (<span className="font-medium">USD ${ticketSizeError.currentTotal.toFixed(2)}</span>) exceeds the ticket size limit (<span className="font-medium">USD ${ticketSizeError.ticketSize.toFixed(2)}</span>) for merchant <span className="font-medium">{ticketSizeError.merchantName}</span>.
                </p>
                <p className="text-xs text-red-500 mt-2">Please reduce the invoice total to be less than the ticket size limit.</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving || ticketSizeError} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                {saving ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </form>
      </Modal>

      {/* View Invoice Modal */}
      <Modal isOpen={!!viewInvoice} title="Invoice Preview" onClose={() => setViewInvoice(null)} size="lg">
        {viewInvoice && <InvoiceView invoice={viewInvoice} onPay={handlePay} payingId={payingId} />}
      </Modal>

      {/* Refund Modal */}
      <Modal isOpen={!!refundModal} title="Mark as Refunded" onClose={() => { setRefundModal(null); setRefundAmount(''); }} size="md">
        {refundModal && (
          <div className="space-y-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                Invoice <span className="font-mono font-medium text-blue-600">{refundModal.invoiceNumber}</span> for
                <span className="font-medium">{refundModal.customerName}</span>
              </p>
              <p className="text-lg font-bold text-blue-700 mt-1">USD ${refundModal.total.toFixed(2)}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Refund Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                min="0.01"
                step="0.01"
                max={refundModal.total}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder={`Enter amount (max $${refundModal.total.toFixed(2)})`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Max refund: ${refundModal.total.toFixed(2)}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setRefundModal(null); setRefundAmount(''); }} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleRefund(refundModal)} className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                Confirm Refund
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Chargeback Modal */}
      <Modal isOpen={!!chargebackModal} title="Mark as Chargebacked" onClose={() => { setChargebackModal(null); setChargebackAmount(''); }} size="md">
        {chargebackModal && (
          <div className="space-y-4">
            <div className="bg-orange-50 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                Invoice <span className="font-mono font-medium text-orange-600">{chargebackModal.invoiceNumber}</span> for
                <span className="font-medium">{chargebackModal.customerName}</span>
              </p>
              <p className="text-lg font-bold text-orange-700 mt-1">USD ${chargebackModal.total.toFixed(2)}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chargeback Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={chargebackAmount}
                onChange={(e) => setChargebackAmount(e.target.value)}
                min="0.01"
                step="0.01"
                max={chargebackModal.total}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder={`Enter amount (max $${chargebackModal.total.toFixed(2)})`}
              />
              <p className="text-xs text-gray-500 mt-1">
                Max chargeback: ${chargebackModal.total.toFixed(2)}
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => { setChargebackModal(null); setChargebackAmount(''); }} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleChargeback(chargebackModal)} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                Confirm Chargeback
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Billing Details Modal */}
      <Modal isOpen={billingDetailsModal} title="Customer & Payment Details" onClose={() => { setBillingDetailsModal(false); setBillingDetails(null); }} size="lg">
        {billingDetails && (
          <div className="space-y-6">
            {/* Invoice Info */}
            <div className="bg-blue-50 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Invoice Information</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-600">Invoice #</p>
                  <p className="font-mono font-medium text-blue-600">{billingDetails.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-gray-600">Amount</p>
                  <p className="font-bold text-blue-700">USD ${billingDetails.amount?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-600">Status</p>
                  <p className="font-medium capitalize">{billingDetails.status}</p>
                </div>
                <div>
                  <p className="text-gray-600">Payment Date</p>
                  <p className="font-medium">{new Date(billingDetails.paymentDate).toLocaleDateString()}</p>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <User size={16} /> Customer Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 text-xs">Name</p>
                  <p className="font-medium text-gray-900">{billingDetails.customerName}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-xs">Email</p>
                  <p className="font-medium text-gray-900">{billingDetails.customerEmail}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-600 text-xs">Serial Number</p>
                  <p className="font-medium text-gray-900">{billingDetails.customerSerialNumber}</p>
                </div>
              </div>
            </div>

            {/* Billing Details */}
            {billingDetails.billingDetails && (
              <>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <MapPin size={16} /> Billing Address
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 text-xs">First Name</p>
                      <p className="font-medium text-gray-900">{billingDetails.billingDetails.firstName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Last Name</p>
                      <p className="font-medium text-gray-900">{billingDetails.billingDetails.lastName}</p>
                    </div>
                    {billingDetails.billingDetails.companyName && (
                      <div className="col-span-2">
                        <p className="text-gray-600 text-xs">Company</p>
                        <p className="font-medium text-gray-900">{billingDetails.billingDetails.companyName}</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <p className="text-gray-600 text-xs">Address Line 1</p>
                      <p className="font-medium text-gray-900">{billingDetails.billingDetails.addressLine1}</p>
                    </div>
                    {billingDetails.billingDetails.addressLine2 && (
                      <div className="col-span-2">
                        <p className="text-gray-600 text-xs">Address Line 2</p>
                        <p className="font-medium text-gray-900">{billingDetails.billingDetails.addressLine2}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-600 text-xs">City</p>
                      <p className="font-medium text-gray-900">{billingDetails.billingDetails.city}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">State</p>
                      <p className="font-medium text-gray-900">{billingDetails.billingDetails.state}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Postal Code</p>
                      <p className="font-medium text-gray-900">{billingDetails.billingDetails.postalCode}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Country</p>
                      <p className="font-medium text-gray-900">{billingDetails.billingDetails.countryCode}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CreditCard size={16} /> Card Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600 text-xs">Cardholder Name</p>
                      <p className="font-medium text-gray-900">{billingDetails.billingDetails.cardholderName}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Card Last 4 Digits</p>
                      <p className="font-mono font-medium text-gray-900">••••{billingDetails.billingDetails.cardLast4}</p>
                    </div>
                    <div>
                      <p className="text-gray-600 text-xs">Payment Gateway</p>
                      <p className="font-medium capitalize text-gray-900">{billingDetails.billingDetails.paymentGateway}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Brand Info */}
            {billingDetails.brand && (
              <div className="border-t pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Brand</h3>
                <p className="text-sm font-medium text-gray-900">{billingDetails.brand.name}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
