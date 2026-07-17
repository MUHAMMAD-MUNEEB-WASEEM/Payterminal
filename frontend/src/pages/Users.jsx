import { useEffect, useState } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { Users as UsersIcon, CheckCircle, XCircle, Clock, Trash2, Building2, UserPlus, Shield, ShieldOff } from 'lucide-react';
import { getImageUrl } from '../utils/api';
import { useAuth } from '../context/AuthContext';

export default function Users() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Brand assignment
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [allBrands, setAllBrands] = useState([]);
  const [userBrands, setUserBrands] = useState([]);
  
  // Compliance user management
  const [showAddComplianceModal, setShowAddComplianceModal] = useState(false);
  const [complianceForm, setComplianceForm] = useState({ username: '', email: '', password: '' });

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/users/${id}/status`, { status });
      toast.success(`User ${status}`);
      fetchUsers();
    } catch {
      toast.error('Failed to update status');
    }
  };

  const deleteUser = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await api.delete(`/users/${id}`);
      toast.success('User deleted');
      fetchUsers();
    } catch {
      toast.error('Failed to delete user');
    }
  };

  const openBrandModal = async (user) => {
    setSelectedUser(user);
    try {
      const [brandsRes, userBrandsRes] = await Promise.all([
        api.get('/brands'),
        api.get(`/user-brands/user/${user._id}`)
      ]);
      setAllBrands(brandsRes.data);
      setUserBrands(userBrandsRes.data);
      setShowBrandModal(true);
    } catch (err) {
      toast.error('Failed to load brands');
    }
  };

  const assignBrand = async (brandId) => {
    try {
      await api.post(`/user-brands/user/${selectedUser._id}/assign`, { brandId });
      toast.success('Brand assigned to user');
      openBrandModal(selectedUser); // Refresh
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign brand');
    }
  };

  const removeBrand = async (brandId) => {
    try {
      await api.delete(`/user-brands/user/${selectedUser._id}/brand/${brandId}`);
      toast.success('Brand removed from user');
      openBrandModal(selectedUser); // Refresh
    } catch (err) {
      toast.error('Failed to remove brand');
    }
  };

  const handleAddCompliance = async (e) => {
    e.preventDefault();
    if (!complianceForm.username || !complianceForm.email || !complianceForm.password) {
      toast.error('All fields are required');
      return;
    }
    try {
      await api.post('/auth/register', {
        ...complianceForm,
        role: 'compliance'
      });
      toast.success('Compliance user created successfully');
      setShowAddComplianceModal(false);
      setComplianceForm({ username: '', email: '', password: '' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create compliance user');
    }
  };

  const revokeCompliance = async (userId) => {
    if (!confirm('Revoke compliance role? This user will become a regular user.')) return;
    try {
      await api.patch(`/users/${userId}/role`, { role: 'user' });
      toast.success('Compliance role revoked');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to revoke compliance role');
    }
  };

  const deleteComplianceUser = async (userId) => {
    if (!confirm('Delete this compliance user? This action cannot be undone.')) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success('Compliance user deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete compliance user');
    }
  };

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>{status}</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  const regularUsers = users.filter(u => u.role === 'user');
  const complianceUsers = users.filter(u => u.role === 'compliance');
  const isAdmin = currentUser?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Compliance Users Section (Admin Only) */}
      {isAdmin && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="text-blue-600" size={24} />
                Compliance Users
              </h2>
              <p className="text-gray-500 text-sm mt-1">Users with elevated permissions and verification requirements</p>
            </div>
            <button
              onClick={() => setShowAddComplianceModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <UserPlus size={16} />
              Add Compliance User
            </button>
          </div>

          <div className="bg-white rounded-xl border border-blue-200 overflow-hidden">
            {complianceUsers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Shield size={32} className="mx-auto mb-2 text-gray-300" />
                <p>No compliance users yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-blue-50">
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">User</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Email</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Status</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Created</th>
                      <th className="text-left px-6 py-3 text-gray-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {complianceUsers.map(user => (
                      <tr key={user._id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <Shield size={18} className="text-blue-600" />
                            </div>
                            <span className="font-medium text-gray-900">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-600">{user.email}</td>
                        <td className="px-6 py-4">{statusBadge(user.status)}</td>
                        <td className="px-6 py-4 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => revokeCompliance(user._id)}
                              title="Revoke Compliance Role"
                              className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-600 transition-colors"
                            >
                              <ShieldOff size={16} />
                            </button>
                            <button
                              onClick={() => deleteComplianceUser(user._id)}
                              title="Delete User"
                              className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Regular Users Section */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">Regular Users</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">User</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Role</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Status</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Joined</th>
                <th className="text-left px-6 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                  <UsersIcon size={32} className="mx-auto mb-2 text-gray-300" />
                  No users registered yet
                </td></tr>
              ) : regularUsers.map(user => (
                <tr key={user._id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-700 font-semibold text-xs uppercase">{user.username[0]}</span>
                      </div>
                      <span className="font-medium text-gray-900">{user.username}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                      user.role === 'compliance' ? 'bg-blue-100 text-blue-700' : 
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">{statusBadge(user.status)}</td>
                  <td className="px-6 py-4 text-gray-500">{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {user.role !== 'admin' && (
                        <button 
                          onClick={() => openBrandModal(user)} 
                          title="Assign Brands" 
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                        >
                          <Building2 size={16} />
                        </button>
                      )}
                      {user.status !== 'approved' && (
                        <button onClick={() => updateStatus(user._id, 'approved')} title="Approve" className="p-1.5 rounded-lg hover:bg-green-50 text-green-600 transition-colors">
                          <CheckCircle size={16} />
                        </button>
                      )}
                      {user.status !== 'rejected' && (
                        <button onClick={() => updateStatus(user._id, 'rejected')} title="Reject" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                          <XCircle size={16} />
                        </button>
                      )}
                      {user.status !== 'pending' && (
                        <button onClick={() => updateStatus(user._id, 'pending')} title="Set Pending" className="p-1.5 rounded-lg hover:bg-yellow-50 text-yellow-600 transition-colors">
                          <Clock size={16} />
                        </button>
                      )}
                      {user.role !== 'admin' && (
                        <button onClick={() => deleteUser(user._id)} title="Delete" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </div>

      <Modal isOpen={showBrandModal && selectedUser} title={selectedUser ? `Assign Brands - ${selectedUser.username}` : ''} onClose={() => setShowBrandModal(false)}>
        <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">Assigned Brands</h3>
              {userBrands.length === 0 ? (
                <p className="text-sm text-gray-500 italic">No brands assigned yet</p>
              ) : (
                <div className="space-y-2">
                  {userBrands.map(brand => (
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
              {allBrands.filter(b => !userBrands.find(ub => ub._id === b._id)).length === 0 ? (
                <p className="text-sm text-gray-500 italic">All brands are assigned</p>
              ) : (
                <div className="space-y-2">
                  {allBrands
                    .filter(b => !userBrands.find(ub => ub._id === b._id))
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

      {/* Add Compliance User Modal */}
      <Modal 
        isOpen={showAddComplianceModal} 
        onClose={() => {
          setShowAddComplianceModal(false);
          setComplianceForm({ username: '', email: '', password: '' });
        }}
        title="Add Compliance User"
      >
        <form onSubmit={handleAddCompliance} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={complianceForm.username}
              onChange={(e) => setComplianceForm({ ...complianceForm, username: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={complianceForm.email}
              onChange={(e) => setComplianceForm({ ...complianceForm, email: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              required
              value={complianceForm.password}
              onChange={(e) => setComplianceForm({ ...complianceForm, password: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter password"
              minLength={6}
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Shield className="text-blue-600 mt-0.5" size={18} />
              <div className="text-sm">
                <p className="font-medium text-blue-900 mb-1">Compliance User Permissions:</p>
                <ul className="text-blue-700 space-y-1 text-xs">
                  <li>• View all invoices and manage archive/unarchive (with verification)</li>
                  <li>• Update refunds and chargebacks</li>
                  <li>• Reset merchant volume and ticket size (with verification)</li>
                  <li>• Toggle merchant active status (with verification)</li>
                  <li>• Create brands and assign merchants (with verification)</li>
                  <li>• Cannot delete invoices, brands, merchants, or users</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setShowAddComplianceModal(false);
                setComplianceForm({ username: '', email: '', password: '' });
              }}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium"
            >
              Create Compliance User
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
