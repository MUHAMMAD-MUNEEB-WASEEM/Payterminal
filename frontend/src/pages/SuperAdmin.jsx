import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Power, PowerOff, Shield, AlertTriangle } from 'lucide-react';

export default function SuperAdmin() {
  const { user, maintenanceMode, toggleMaintenanceMode } = useAuth();
  const [toggling, setToggling] = useState(false);

  if (user?.role !== 'superadmin') {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 text-lg font-semibold">Access Denied</p>
        <p className="text-gray-600 mt-2">You don't have permission to access this page.</p>
      </div>
    );
  }

  const handleToggle = async () => {
    if (toggling) return;
    
    const newState = !maintenanceMode;
    const confirmMsg = newState
      ? 'Enable maintenance mode? This will show 404 to all users except you (super admin).'
      : 'Disable maintenance mode? This will restore normal access for all users.';
    
    if (!confirm(confirmMsg)) return;
    
    setToggling(true);
    try {
      await toggleMaintenanceMode(newState);
      toast.success(`Maintenance mode ${newState ? 'ENABLED' : 'DISABLED'}`);
    } catch (err) {
      toast.error('Failed to toggle maintenance mode');
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Shield size={28} className="text-purple-600" />
            Super Admin Panel
          </h1>
          <p className="text-gray-500 text-sm mt-1">System-level controls and management</p>
        </div>
      </div>

      {/* Maintenance Mode Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 p-6 text-white">
          <div className="flex items-center gap-3">
            {maintenanceMode ? (
              <PowerOff size={32} className="text-white" />
            ) : (
              <Power size={32} className="text-white" />
            )}
            <div>
              <h2 className="text-xl font-bold">Maintenance Mode</h2>
              <p className="text-purple-100 text-sm mt-1">
                Control system accessibility for regular users
              </p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-gray-900 text-lg">Current Status</h3>
              <p className="text-gray-600 text-sm mt-1">
                {maintenanceMode
                  ? 'System is currently in maintenance mode - users see 404 page'
                  : 'System is operating normally - all users have access'}
              </p>
            </div>
            <div className={`px-6 py-3 rounded-full font-bold text-lg ${
              maintenanceMode
                ? 'bg-red-100 text-red-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {maintenanceMode ? 'OFFLINE' : 'ONLINE'}
            </div>
          </div>

          {/* Warning */}
          {maintenanceMode && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-900">Maintenance Mode Active</h4>
                  <p className="text-yellow-700 text-sm mt-1">
                    All regular users and admins are seeing a 404 error page. Only you (super admin) can access the system.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Toggle Button */}
          <div className="flex items-center justify-center gap-4 py-6 border-t border-gray-200">
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`flex items-center gap-3 px-8 py-4 rounded-lg font-bold text-lg transition-all ${
                maintenanceMode
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {maintenanceMode ? (
                <>
                  <Power size={24} />
                  {toggling ? 'Enabling...' : 'Enable System'}
                </>
              ) : (
                <>
                  <PowerOff size={24} />
                  {toggling ? 'Disabling...' : 'Disable System'}
                </>
              )}
            </button>
          </div>

          {/* Info */}
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">How it works:</h4>
            <ul className="text-sm text-gray-600 space-y-1.5">
              <li>• <strong>When ENABLED:</strong> All users (normal + admin) see a 404 error page and cannot access the system</li>
              <li>• <strong>Super admin only:</strong> You can still login and access everything normally</li>
              <li>• <strong>When DISABLED:</strong> System operates normally for everyone</li>
              <li>• <strong>Use case:</strong> System maintenance, updates, or temporarily blocking access</li>
            </ul>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Super Admin Info</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Username:</span>
            <span className="ml-2 font-medium">{user.username}</span>
          </div>
          <div>
            <span className="text-gray-600">Role:</span>
            <span className="ml-2 font-medium text-purple-600">Super Admin</span>
          </div>
          <div>
            <span className="text-gray-600">Access Level:</span>
            <span className="ml-2 font-medium">Full System Control</span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>
            <span className="ml-2 font-medium text-green-600">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
