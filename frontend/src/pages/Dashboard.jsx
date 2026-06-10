import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Building2, FileText, Users, DollarSign, TrendingUp, Clock } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({ brands: 0, invoices: 0, users: 0, revenue: 0, pending: 0, paid: 0 });
  const [recentInvoices, setRecentInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [brandsRes, invoicesRes] = await Promise.all([
          api.get('/brands'),
          api.get('/invoices'),
        ]);

        let usersCount = 0;
        try {
          const usersRes = await api.get('/users');
          usersCount = usersRes.data.length;
        } catch {}

        const invoices = invoicesRes.data;
        // Calculate net revenue: paid invoices minus refunded and chargebacked amounts
        const revenue = invoices
          .filter(i => i.status === 'paid')
          .reduce((s, i) => s + (i.total - (i.refundAmount || 0) - (i.chargebackAmount || 0)), 0);
        const pending = invoices.filter(i => i.status === 'pending').length;
        const paid = invoices.filter(i => i.status === 'paid').length;
        // Calculate total refunds and chargebacks for display
        const refunds = invoices.filter(i => i.status === 'refunded').reduce((s, i) => s + (i.refundAmount || 0), 0);
        const chargebacks = invoices.filter(i => i.status === 'chargebacked').reduce((s, i) => s + (i.chargebackAmount || 0), 0);

        setStats({ brands: brandsRes.data.length, invoices: invoices.length, users: usersCount, revenue, pending, paid, refunds, chargebacks });
        setRecentInvoices(invoices.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const cards = [
    { label: 'Total Brands', value: stats.brands, icon: Building2, color: 'blue' },
    { label: 'Total Invoices', value: stats.invoices, icon: FileText, color: 'indigo' },
    { label: 'Total Users', value: stats.users, icon: Users, color: 'violet' },
    { label: 'Net Revenue (USD)', value: `$${stats.revenue.toFixed(2)}`, icon: DollarSign, color: 'green' },
    { label: 'Refunds (USD)', value: `$${(stats.refunds || 0).toFixed(2)}`, icon: DollarSign, color: 'red' },
    { label: 'Chargebacks (USD)', value: `$${(stats.chargebacks || 0).toFixed(2)}`, icon: DollarSign, color: 'orange' },
    { label: 'Pending Invoices', value: stats.pending, icon: Clock, color: 'yellow' },
    { label: 'Paid Invoices', value: stats.paid, icon: TrendingUp, color: 'emerald' },
  ];

  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    violet: 'bg-violet-50 text-violet-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  const statusBadge = (status) => {
    const map = { pending: 'bg-yellow-100 text-yellow-700', paid: 'bg-green-100 text-green-700', failed: 'bg-red-100 text-red-700' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || ''}`}>{status}</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Overview of your USPTO admin panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
              <Icon size={22} />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value}</p>
              <p className="text-sm text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Invoices */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Recent Invoices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Invoice #</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Brand</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Total</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No invoices yet</td></tr>
              ) : recentInvoices.map(inv => (
                <tr key={inv._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono font-medium text-blue-600">{inv.invoiceNumber}</td>
                  <td className="px-6 py-3 text-gray-700">{inv.brand?.name || '—'}</td>
                  <td className="px-6 py-3 font-medium">USD ${inv.total?.toFixed(2)}</td>
                  <td className="px-6 py-3">{statusBadge(inv.status)}</td>
                  <td className="px-6 py-3 text-gray-500">{new Date(inv.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
