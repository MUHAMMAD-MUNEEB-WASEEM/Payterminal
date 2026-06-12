import { useState, useEffect } from 'react';
import axios from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { Plus, Edit2, Trash2, Power, PowerOff, Building2 } from 'lucide-react';
import { getImageUrl } from '../utils/api';

export default function Merchants() {
  const [merchants, setMerchants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingMerchant, setEditingMerchant] = useState(null);
  const [formData, setFormData] = useState({
    nickname: '',
    gateway: 'stripe',
    credentials: {},
    amountLimit: '',
    ticketSize: ''
  });
  
  // Brand assignment
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [allBrands, setAllBrands] = useState([]);
  const [merchantBrands, setMerchantBrands] = useState([]);

  useEffect(() => {
    fetchMerchants();
  }, []);

  const fetchMerchants = async () => {
    try {
      const res = await axios.get('/merchants');
      setMerchants(res.data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load merchants');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate nickname
    if (!formData.nickname.trim()) {
      return toast.error('Nickname is required');
    }
    
    try {
      if (editingMerchant) {
        await axios.patch(`/merchants/${editingMerchant._id}`, formData);
        toast.success('Merchant updated successfully');
      } else {
        await axios.post('/merchants', formData);
        toast.success('Merchant created successfully');
      }
      
      // Refresh merchants list first
      await fetchMerchants();
      
      // Then close modal and reset form
      setShowModal(false);
      setEditingMerchant(null);
      setFormData({ nickname: '', gateway: 'stripe', credentials: {} });
    } catch (err) {
      console.error('Merchant save error:', err);
      toast.error(err.response?.data?.message || 'Failed to save merchant');
    }
  };

  const handleEdit = (merchant) => {
    setEditingMerchant(merchant);
    setFormData({
      nickname: merchant.nickname,
      gateway: merchant.gateway,
      credentials: merchant.credentials?.configured ? {} : merchant.credentials || {},
      amountLimit: merchant.amountLimit || '',
      ticketSize: merchant.ticketSize || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this merchant?')) return;
    try {
      await axios.delete(`/merchants/${id}`);
      toast.success('Merchant deleted successfully');
      fetchMerchants();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete merchant');
    }
  };

  const toggleActive = async (merchant) => {
    try {
      await axios.patch(`/merchants/${merchant._id}`, {
        isActive: !merchant.isActive
      });
      toast.success(`Merchant ${!merchant.isActive ? 'activated' : 'deactivated'}`);
      fetchMerchants();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update merchant');
    }
  };

  const handleCredentialChange = (key, value) => {
    setFormData(prev => ({
      ...prev,
      credentials: { ...prev.credentials, [key]: value }
    }));
  };

  const getGatewayIcon = (gateway) => {
    const icons = {
      stripe: '💳',
      paypal: '🅿️',
      authorize: '🔐',
      beyondbancard: '🏦'
    };
    return icons[gateway] || '💰';
  };

  const openBrandModal = async (merchant) => {
    setSelectedMerchant(merchant);
    try {
      const [brandsRes, merchantBrandsRes] = await Promise.all([
        axios.get('/brands'),
        axios.get(`/merchants/brand-list/${merchant._id}`)
      ]);
      setAllBrands(brandsRes.data);
      setMerchantBrands(merchantBrandsRes.data);
      setShowBrandModal(true);
    } catch (err) {
      toast.error('Failed to load brands');
    }
  };

  const assignBrand = async (brandId) => {
    try {
      await axios.post(`/merchants/brand/${brandId}/assign`, { merchantId: selectedMerchant._id });
      toast.success('Brand assigned to merchant');
      openBrandModal(selectedMerchant); // Refresh
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign brand');
    }
  };

  const removeBrand = async (brandId) => {
    try {
      await axios.delete(`/merchants/brand/${brandId}/merchant/${selectedMerchant._id}`);
      toast.success('Brand removed from merchant');
      openBrandModal(selectedMerchant); // Refresh
    } catch (err) {
      toast.error('Failed to remove brand');
    }
  };

  const resetProcessedAmount = async (merchantId) => {
    if (!confirm('Reset processed amount to $0.00? This will allow the merchant to process payments again.')) return;
    try {
      await axios.patch(`/merchants/${merchantId}`, { processedAmount: 0 });
      toast.success('Processed amount reset successfully');
      fetchMerchants();
    } catch (err) {
      toast.error('Failed to reset amount');
    }
  };

  const testAuthorizeCredentials = async () => {
    if (!editingMerchant && formData.gateway !== 'authorize') {
      return toast.error('Please select Authorize.net gateway first');
    }
    
    if (!formData.credentials.apiLoginId || !formData.credentials.transactionKey) {
      return toast.error('Please enter API Login ID and Transaction Key');
    }

    try {
      const res = await axios.post('/merchants/test-authorize', {
        apiLoginId: formData.credentials.apiLoginId,
        transactionKey: formData.credentials.transactionKey,
        mode: formData.credentials.mode || 'sandbox'
      });

      if (res.data.success) {
        toast.success('✅ Credentials are valid! Authentication successful.');
      } else {
        toast.error(`❌ ${res.data.message}\nError: ${res.data.errorText || res.data.error}`);
      }
    } catch (err) {
      toast.error('Test failed: ' + (err.response?.data?.message || err.message));
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payment Merchants</h1>
          <p className="text-gray-600 mt-1">Manage payment gateway configurations</p>
        </div>
        <button
          onClick={() => {
            setEditingMerchant(null);
            setFormData({ nickname: '', gateway: 'stripe', credentials: {}, amountLimit: '', ticketSize: '' });
            setShowModal(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus size={20} />
          Add Merchant
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {merchants.map(merchant => (
          <div key={merchant._id} className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getGatewayIcon(merchant.gateway)}</span>
                <div>
                  <h3 className="font-semibold text-gray-800">{merchant.nickname}</h3>
                  <p className="text-sm text-gray-500 capitalize">{merchant.gateway}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleActive(merchant)}
                  className={`p-2 rounded ${merchant.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-50'}`}
                  title={merchant.isActive ? 'Active' : 'Inactive'}
                >
                  {merchant.isActive ? <Power size={18} /> : <PowerOff size={18} />}
                </button>
              </div>
            </div>

            <div className="mb-4">
              <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                merchant.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {merchant.isActive ? 'Active' : 'Inactive'}
              </span>
              {merchant.credentials?.configured && (
                <span className="ml-2 inline-block px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                  Configured
                </span>
              )}
            </div>

            {/* Amount Limit Progress */}
            {merchant.amountLimit && merchant.amountLimit > 0 && (
              <div className="mb-4">
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>Processed</span>
                  <span>${(merchant.processedAmount || 0).toFixed(2)} / ${merchant.amountLimit.toFixed(2)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      (merchant.processedAmount || 0) >= merchant.amountLimit 
                        ? 'bg-red-500' 
                        : (merchant.processedAmount || 0) >= merchant.amountLimit * 0.8 
                        ? 'bg-yellow-500' 
                        : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(((merchant.processedAmount || 0) / merchant.amountLimit) * 100, 100)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  {(merchant.processedAmount || 0) >= merchant.amountLimit ? (
                    <p className="text-xs text-red-600 font-medium">⚠ Limit reached</p>
                  ) : (
                    <p className="text-xs text-gray-500">
                      ${(merchant.amountLimit - (merchant.processedAmount || 0)).toFixed(2)} remaining
                    </p>
                  )}
                  {(merchant.processedAmount || 0) > 0 && (
                    <button
                      onClick={() => resetProcessedAmount(merchant._id)}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => openBrandModal(merchant)}
                className="flex-1 bg-purple-50 text-purple-600 px-3 py-2 rounded hover:bg-purple-100 flex items-center justify-center gap-2"
                title="Assign to Brands"
              >
                <Building2 size={16} />
                Brands
              </button>
              <button
                onClick={() => handleEdit(merchant)}
                className="flex-1 bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 flex items-center justify-center gap-2"
              >
                <Edit2 size={16} />
                Edit
              </button>
              <button
                onClick={() => handleDelete(merchant._id)}
                className="flex-1 bg-red-50 text-red-600 px-3 py-2 rounded hover:bg-red-100 flex items-center justify-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {merchants.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <p className="text-gray-500 mb-4">No merchants configured yet</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
          >
            Add Your First Merchant
          </button>
        </div>
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingMerchant ? 'Edit Merchant' : 'Add Merchant'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Main Stripe Account"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Gateway</label>
            <select
              value={formData.gateway}
              onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={editingMerchant}
            >
              <option value="stripe">Stripe</option>
              <option value="paypal">PayPal</option>
              <option value="authorize">Authorize.net</option>
              <option value="beyondbancard">BeyondBancard</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount Limit (USD) <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.amountLimit}
              onChange={(e) => setFormData({ ...formData, amountLimit: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 10000.00"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty for no limit. Merchant will auto-disable when limit is reached.</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ticket Size (USD) <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={formData.ticketSize}
              onChange={(e) => setFormData({ ...formData, ticketSize: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., 5000.00"
            />
            <p className="text-xs text-gray-500 mt-1">Maximum amount for a single invoice. Invoices {'>'}= this amount cannot be created. Leave empty for no limit.</p>
          </div>

          {formData.gateway === 'stripe' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
                <input
                  type="password"
                  value={formData.credentials.secretKey || ''}
                  onChange={(e) => handleCredentialChange('secretKey', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="sk_test_..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publishable Key</label>
                <input
                  type="text"
                  value={formData.credentials.publishableKey || ''}
                  onChange={(e) => handleCredentialChange('publishableKey', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="pk_test_..."
                />
              </div>
            </>
          )}

          {formData.gateway === 'paypal' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input
                  type="text"
                  value={formData.credentials.clientId || ''}
                  onChange={(e) => handleCredentialChange('clientId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="PayPal Client ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                <input
                  type="password"
                  value={formData.credentials.clientSecret || ''}
                  onChange={(e) => handleCredentialChange('clientSecret', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="PayPal Client Secret"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                <select
                  value={formData.credentials.mode || 'sandbox'}
                  onChange={(e) => handleCredentialChange('mode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
              </div>
            </>
          )}

          {formData.gateway === 'authorize' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Login ID</label>
                <input
                  type="text"
                  value={formData.credentials.apiLoginId || ''}
                  onChange={(e) => handleCredentialChange('apiLoginId', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="API Login ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Key</label>
                <input
                  type="password"
                  value={formData.credentials.transactionKey || ''}
                  onChange={(e) => handleCredentialChange('transactionKey', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Transaction Key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                <select
                  value={formData.credentials.mode || 'sandbox'}
                  onChange={(e) => handleCredentialChange('mode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="live">Live</option>
                </select>
              </div>
              <div>
                <button
                  type="button"
                  onClick={testAuthorizeCredentials}
                  className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                >
                  🧪 Test Credentials
                </button>
                <p className="text-xs text-gray-500 mt-1">Test if your API credentials are working</p>
              </div>
            </>
          )}

          {formData.gateway === 'beyondbancard' && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ NMI Integration:</strong> BeyondBancard is powered by NMI. Use NMI credentials below.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Security Key (API Key)</label>
                <input
                  type="password"
                  value={formData.credentials.security_key || ''}
                  onChange={(e) => handleCredentialChange('security_key', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="NMI Security Key (from API Settings)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your NMI private API key for server-to-server communication. Found in NMI merchant portal under Security Keys → Private.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tokenization Key (Public)</label>
                <input
                  type="text"
                  value={formData.credentials.tokenizationKey || ''}
                  onChange={(e) => handleCredentialChange('tokenizationKey', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="NMI Tokenization Key (for Collect.js)"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your NMI public tokenization key for Collect.js. Found in NMI merchant portal under Security Keys → Tokenization.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
                <select
                  value={formData.credentials.mode || 'sandbox'}
                  onChange={(e) => handleCredentialChange('mode', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="sandbox">Sandbox (Test)</option>
                  <option value="live">Live (Production)</option>
                </select>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-xs text-yellow-800 mb-2">
                  <strong>📋 Where to find credentials:</strong>
                </p>
                <ul className="text-xs text-yellow-800 space-y-1 ml-3 list-disc">
                  <li>Go to NMI Merchant Portal: <code className="bg-white px-1 rounded">merchant.nmi.com</code></li>
                  <li>Security Settings → API Keys / Security Keys</li>
                  <li>Copy Private/Security Key for backend</li>
                  <li>Copy Public/Tokenization Key for frontend</li>
                </ul>
              </div>
            </>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              {editingMerchant ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showBrandModal && selectedMerchant} title={selectedMerchant ? `Assign Brands - ${selectedMerchant.nickname}` : ''} onClose={() => setShowBrandModal(false)}>
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Assigned Brands</h3>
            {merchantBrands.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No brands assigned yet</p>
            ) : (
              <div className="space-y-2">
                {merchantBrands.map(brand => (
                  <div key={brand._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {brand.logo ? (
                        <img src={getImageUrl(brand.logo)} alt={brand.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                      ) : (
                        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                          <Building2 size={18} className="text-blue-400" />
                        </div>
                      )}
                      <div>
                        <p className="font-medium text-gray-900">{brand.name}</p>
                        <p className="text-xs text-gray-500">Office # {brand.brandNo || 'N/A'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeBrand(brand._id)}
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">Available Brands</h3>
            {allBrands.filter(b => !merchantBrands.find(mb => mb._id === b._id)).length === 0 ? (
              <p className="text-sm text-gray-500 italic">All brands are assigned</p>
            ) : (
              <div className="space-y-2">
                {allBrands
                  .filter(b => !merchantBrands.find(mb => mb._id === b._id))
                  .map(brand => (
                    <div key={brand._id} className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3">
                        {brand.logo ? (
                          <img src={getImageUrl(brand.logo)} alt={brand.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
                        ) : (
                          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                            <Building2 size={18} className="text-blue-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{brand.name}</p>
                          <p className="text-xs text-gray-500">Office # {brand.brandNo || 'N/A'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => assignBrand(brand._id)}
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
