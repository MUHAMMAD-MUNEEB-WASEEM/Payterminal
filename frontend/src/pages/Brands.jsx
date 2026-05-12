import { useEffect, useState } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, Building2, CreditCard } from 'lucide-react';

const EMPTY_FORM = { name: '', brandNo: '', logo: null, redirectUrl: '', enableRedirect: false };

export default function Brands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Merchant assignment
  const [showMerchantModal, setShowMerchantModal] = useState(false);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [allMerchants, setAllMerchants] = useState([]);
  const [brandMerchants, setBrandMerchants] = useState([]);

  const fetchBrands = async () => {
    try {
      const res = await api.get('/brands');
      const brandsWithMerchants = await Promise.all(
        res.data.map(async (brand) => {
          try {
            const merchantsRes = await api.get(`/merchants/brand/${brand._id}`);
            return { ...brand, merchants: merchantsRes.data };
          } catch {
            return { ...brand, merchants: [] };
          }
        })
      );
      setBrands(brandsWithMerchants);
    } catch (err) {
      toast.error('Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setPreview(null);
    setShowModal(true);
  };

  const openEdit = (brand) => {
    setEditing(brand);
    setForm({ 
      name: brand.name, 
      brandNo: brand.brandNo || '', 
      logo: null,
      redirectUrl: brand.redirectUrl || '',
      enableRedirect: brand.enableRedirect || false
    });
    setPreview(brand.logo ? `http://localhost:5000${brand.logo}` : null);
    setShowModal(true);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setForm({ ...form, logo: file });
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editing && !form.logo) return toast.error('Brand logo is required');
    setSaving(true);
    try {
      const data = new FormData();
      data.append('name', form.name);
      data.append('brandNo', form.brandNo);
      data.append('redirectUrl', form.redirectUrl);
      data.append('enableRedirect', form.enableRedirect);
      if (form.logo) data.append('logo', form.logo);

      if (editing) {
        await api.put(`/brands/${editing._id}`, data);
        toast.success('Brand updated');
      } else {
        await api.post('/brands', data);
        toast.success('Brand created');
      }
      setShowModal(false);
      fetchBrands();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save brand');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this brand?')) return;
    try {
      await api.delete(`/brands/${id}`);
      toast.success('Brand deleted');
      fetchBrands();
    } catch {
      toast.error('Failed to delete brand');
    }
  };

  const openMerchantModal = async (brand) => {
    setSelectedBrand(brand);
    try {
      const [merchantsRes, brandMerchantsRes] = await Promise.all([
        api.get('/merchants'),
        api.get(`/merchants/brand/${brand._id}`)
      ]);
      setAllMerchants(merchantsRes.data.filter(m => m.isActive));
      setBrandMerchants(brandMerchantsRes.data);
      setShowMerchantModal(true);
    } catch (err) {
      toast.error('Failed to load merchants');
    }
  };

  const assignMerchant = async (merchantId) => {
    try {
      await api.post(`/merchants/brand/${selectedBrand._id}/assign`, { merchantId });
      toast.success('Merchant assigned to brand');
      openMerchantModal(selectedBrand); // Refresh
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign merchant');
    }
  };

  const removeMerchant = async (merchantId) => {
    try {
      await api.delete(`/merchants/brand/${selectedBrand._id}/merchant/${merchantId}`);
      toast.success('Merchant removed from brand');
      openMerchantModal(selectedBrand); // Refresh
    } catch (err) {
      toast.error('Failed to remove merchant');
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Brands</h1>
          <p className="text-gray-500 text-sm mt-1">{brands.length} brand{brands.length !== 1 ? 's' : ''} total</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> Add Brand
        </button>
      </div>

      {brands.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Building2 size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No brands yet. Create your first brand.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands.map(brand => (
            <div key={brand._id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {brand.logo ? (
                    <img src={`http://localhost:5000${brand.logo}`} alt={brand.name} className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                  ) : (
                    <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                      <Building2 size={20} className="text-blue-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">{brand.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Office # {brand.brandNo || <span className="italic text-gray-400">N/A</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openMerchantModal(brand)} className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors" title="Manage Merchants">
                    <CreditCard size={15} />
                  </button>
                  <button onClick={() => openEdit(brand)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => handleDelete(brand._id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Assigned Merchants */}
              {brand.merchants && brand.merchants.length > 0 ? (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-500 font-medium mb-2">Payment Methods ({brand.merchants.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {brand.merchants.map(merchant => (
                      <span
                        key={merchant._id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded text-xs font-medium"
                        title={merchant.nickname}
                      >
                        <span>{merchant.gateway === 'stripe' ? '💳' : merchant.gateway === 'paypal' ? '🅿️' : '🔐'}</span>
                        <span className="max-w-[100px] truncate">{merchant.nickname}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs text-gray-400 italic">No payment methods assigned</p>
                </div>
              )}

              <p className="text-xs text-gray-400 mt-3">Created {new Date(brand.createdAt).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showModal} title={editing ? 'Edit Brand' : 'Add Brand'} onClose={() => setShowModal(false)}>
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand Name <span className="text-red-500">*</span></label>
              <input
                type="text" required value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter brand name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand No <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                type="text" value={form.brandNo}
                onChange={e => setForm({ ...form, brandNo: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. 1023"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Brand Logo {!editing && <span className="text-red-500">*</span>}
              </label>
              {preview && (
                <img src={preview} alt="Preview" className="w-20 h-20 rounded-lg object-cover border border-gray-200 mb-2" />
              )}
              <input
                type="file" accept="image/*"
                onChange={handleLogoChange}
                className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 file:font-medium hover:file:bg-blue-100"
              />
            </div>
            
            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Post-Payment Settings</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Redirect URL <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="url"
                  value={form.redirectUrl}
                  onChange={e => setForm({ ...form, redirectUrl: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://example.com"
                />
                <p className="text-xs text-gray-500 mt-1">Where to redirect customers after successful payment</p>
              </div>

              <div className="mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.enableRedirect}
                    onChange={e => setForm({ ...form, enableRedirect: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Enable automatic redirect after payment</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  {form.enableRedirect 
                    ? 'Customers will be redirected to the URL above after payment' 
                    : 'Customers will see a success page instead of being redirected'}
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-lg text-sm font-medium">
                {saving ? 'Saving...' : editing ? 'Update Brand' : 'Create Brand'}
              </button>
            </div>
          </form>
      </Modal>

      <Modal isOpen={showMerchantModal && selectedBrand} title={selectedBrand ? `Manage Merchants - ${selectedBrand.name}` : ''} onClose={() => setShowMerchantModal(false)}>
        <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Assigned Merchants</h3>
              {brandMerchants.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No merchants assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {brandMerchants.map(merchant => (
                    <div key={merchant._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{merchant.gateway === 'stripe' ? '💳' : merchant.gateway === 'paypal' ? '🅿️' : '🔐'}</span>
                        <div>
                          <p className="font-medium text-gray-900">{merchant.nickname}</p>
                          <p className="text-xs text-gray-500 capitalize">{merchant.gateway}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeMerchant(merchant._id)}
                        className="text-red-600 hover:bg-red-50 px-3 py-1 rounded text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Available Merchants</h3>
              {allMerchants.filter(m => !brandMerchants.find(bm => bm._id === m._id)).length === 0 ? (
                <p className="text-sm text-gray-500 italic">All merchants are assigned</p>
              ) : (
                <div className="space-y-2">
                  {allMerchants
                    .filter(m => !brandMerchants.find(bm => bm._id === m._id))
                    .map(merchant => (
                      <div key={merchant._id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{merchant.gateway === 'stripe' ? '💳' : merchant.gateway === 'paypal' ? '🅿️' : '🔐'}</span>
                          <div>
                            <p className="font-medium text-gray-900">{merchant.nickname}</p>
                            <p className="text-xs text-gray-500 capitalize">{merchant.gateway}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => assignMerchant(merchant._id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm"
                        >
                          Assign
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
        </div>
      </Modal>
    </div>
  );
}
