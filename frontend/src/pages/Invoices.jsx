import { useEffect, useState } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import InvoiceView from '../components/InvoiceView';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { Plus, Eye, Trash2, Link as LinkIcon, FileText, RefreshCw, CheckCircle } from 'lucide-react';

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
    items[i] = { ...items[i], [field]: value };
    setForm({ ...form, items });
  };

  const total = form.items.reduce((s, item) => s + (parseFloat(item.amount) || 0), 0);

  const handleCreate = async (e) => {
    e.preventDefault();
    const validItems = form.items.filter(i => i.description && i.amount);
    if (!form.brandId) return toast.error('Select a brand');
    if (validItems.length === 0) return toast.error('Add at least one item');
    if (!form.customerName) return toast.error('Customer name is required');
    if (!form.customerEmail) return toast.error('Customer email is required');
    if (!form.customerSerialNumber) return toast.error('Customer serial number is required');
    
    setSaving(true);
    try {
      await api.post('/invoices', { ...form, items: validItems });
      toast.success('Invoice created');
      setShowCreate(false);
      setForm(EMPTY_FORM);
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

  const statusBadge = (status) => {
    const map = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || ''}`}>{status}</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-500 text-sm mt-1">{invoices.length} invoice{invoices.length !== 1 ? 's' : ''} total</p>
        </div>
        <button onClick={() => { setForm(EMPTY_FORM); setShowCreate(true); }} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> New Invoice
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Invoice #</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Brand</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Office #</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Total</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                  <FileText size={32} className="mx-auto mb-2 text-gray-300" />
                  No invoices yet
                </td></tr>
              ) : invoices.map(inv => (
                <tr key={inv._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4 font-mono font-medium text-blue-600">{inv.invoiceNumber}</td>
                  <td className="px-6 py-4 text-gray-700">{inv.brand?.name || '—'}</td>
                  <td className="px-6 py-4 text-gray-600">{inv.brandNo || <span className="text-gray-400 italic">N/A</span>}</td>
                  <td className="px-6 py-4 font-semibold">USD ${inv.total?.toFixed(2)}</td>
                  <td className="px-6 py-4">{statusBadge(inv.status)}</td>
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
                        <span className="p-1.5 text-green-600" title="Paid">
                          <CheckCircle size={15} />
                        </span>
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

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => setShowCreate(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                {saving ? 'Creating...' : 'Create Invoice'}
              </button>
            </div>
          </form>
      </Modal>

      {/* View Invoice Modal */}
      <Modal isOpen={!!viewInvoice} title="Invoice Preview" onClose={() => setViewInvoice(null)} size="lg">
        {viewInvoice && <InvoiceView invoice={viewInvoice} onPay={handlePay} payingId={payingId} />}
      </Modal>
    </div>
  );
}
