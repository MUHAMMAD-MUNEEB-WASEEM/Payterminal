import axios from 'axios';

// Determine API URL based on environment
let API_URL = import.meta.env.VITE_API_URL;

// If not set, use defaults based on hostname
if (!API_URL) {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    API_URL = 'http://localhost:5000';
  } else {
    // Production - use Render backend
    API_URL = 'https://payterminal.onrender.com';
  }
}

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
