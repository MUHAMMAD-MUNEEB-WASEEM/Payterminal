import axios from 'axios';

// Determine API URL at runtime (not build time)
function getApiUrl() {
  // Check if we're in production (Vercel)
  if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('payterminalportal.com')) {
    return 'https://payterminal.onrender.com';
  }
  
  // Local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000';
  }
  
  // Fallback
  return 'https://payterminal.onrender.com';
}

const API_URL = getApiUrl();
console.log('API URL:', API_URL);

const api = axios.create({
  baseURL: `${API_URL}/api`,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
