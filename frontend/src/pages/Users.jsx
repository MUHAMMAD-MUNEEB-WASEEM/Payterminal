import { useEffect, useState } from 'react';
import api from '../api/axios';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import { Users as UsersIcon, CheckCircle, XCircle, Clock, Trash2, Building2 } from 'lucide-react';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Brand assignment
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [allBrands, setAllBrands] = useState([]);
  const [userBrands, setUserBrands] = useState([]);

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

  const statusBadge = (status) => {
    const map = {
      pending: 'bg-yellow-100 text-yellow-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
    };
    return <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>{status}</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Users</h1>
        <p className="text-gray-500 text-sm mt-1">Manage user access and approvals</p>
      </div>

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
              ) : users.map(user => (
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
                      user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'
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
                          <img src={`http://localhost:5000${brand.logo}`} alt={brand.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
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
                            <img src={`http://localhost:5000${brand.logo}`} alt={brand.name} className="w-10 h-10 rounded-lg object-cover border border-gray-200" />
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
