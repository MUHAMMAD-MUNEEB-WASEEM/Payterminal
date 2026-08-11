import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(false);
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  // Check maintenance mode on mount
  useEffect(() => {
    const checkMaintenance = async () => {
      try {
        const res = await api.get('/auth/maintenance-status');
        setMaintenanceMode(res.data.maintenanceMode);
      } catch (err) {
        console.error('Failed to check maintenance status:', err);
      }
    };
    checkMaintenance();
    
    // Check every 30 seconds
    const interval = setInterval(checkMaintenance, 30000);
    return () => clearInterval(interval);
  }, []);

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    
    // Refresh maintenance status after login
    try {
      const maintenanceRes = await api.get('/auth/maintenance-status');
      setMaintenanceMode(maintenanceRes.data.maintenanceMode);
    } catch (err) {
      console.error('Failed to check maintenance status:', err);
    }
    
    return res.data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const toggleMaintenanceMode = async (enabled) => {
    const res = await api.post('/auth/maintenance-mode', { enabled });
    setMaintenanceMode(res.data.maintenanceMode);
    return res.data;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, maintenanceMode, toggleMaintenanceMode }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
