import { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { Shield, User } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginType = searchParams.get('type') || 'user'; // 'admin' or 'user'
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const user = await login(form.username, form.password);
      
      // Validate login type matches user role
      if (loginType === 'admin' && user.role !== 'admin') {
        toast.error('Please use User Login for regular accounts');
        setLoading(false);
        return;
      }
      if (loginType === 'user' && user.role === 'admin') {
        toast.error('Please use Admin Login for admin accounts');
        setLoading(false);
        return;
      }
      
      toast.success('Welcome back!');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = loginType === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className={`w-16 h-16 ${isAdmin ? 'bg-purple-600' : 'bg-blue-600'} rounded-2xl flex items-center justify-center mx-auto mb-4`}>
            {isAdmin ? (
              <Shield className="text-white" size={32} />
            ) : (
              <User className="text-white" size={32} />
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isAdmin ? 'Admin Login' : 'User Login'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isAdmin ? 'Sign in to admin dashboard' : 'Sign in to your account'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter password"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full ${isAdmin ? 'bg-purple-600 hover:bg-purple-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors`}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-center text-sm text-gray-500 mb-3">
            {isAdmin ? 'Not an admin?' : 'Are you an admin?'}
          </p>
          <Link
            to={`/login?type=${isAdmin ? 'user' : 'admin'}`}
            className={`block text-center px-4 py-2.5 border-2 ${isAdmin ? 'border-blue-600 text-blue-600 hover:bg-blue-50' : 'border-purple-600 text-purple-600 hover:bg-purple-50'} rounded-lg font-medium transition-colors`}
          >
            {isAdmin ? 'Switch to User Login' : 'Switch to Admin Login'}
          </Link>
        </div>

        {!isAdmin && (
          <p className="text-center text-sm text-gray-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-blue-600 hover:underline font-medium">Sign up</Link>
          </p>
        )}

        <Link to="/" className="block text-center text-sm text-gray-400 hover:text-gray-600 mt-4">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
