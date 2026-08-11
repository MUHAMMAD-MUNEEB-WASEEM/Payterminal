import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Brands from './pages/Brands';
import Invoices from './pages/Invoices';
import Users from './pages/Users';
import Merchants from './pages/Merchants';
import SuperAdmin from './pages/SuperAdmin';
import PublicInvoice from './pages/PublicInvoice';
import PaymentSuccess from './pages/PaymentSuccess';

function PrivateRoute({ children, adminOnly = false, adminOrCompliance = false, superAdminOnly = false }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (superAdminOnly && user.role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  if (adminOnly && user.role !== 'admin' && user.role !== 'superadmin') return <Navigate to="/dashboard" replace />;
  if (adminOrCompliance && !['admin', 'compliance', 'superadmin'].includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" replace /> : <Landing />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/pay/:invoiceId" element={<PublicInvoice />} />
      <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/invoices" element={<PrivateRoute><Invoices /></PrivateRoute>} />
      
      {/* Super Admin only routes */}
      <Route path="/superadmin" element={<PrivateRoute superAdminOnly><SuperAdmin /></PrivateRoute>} />
      
      {/* Admin or Compliance routes */}
      <Route path="/brands" element={<PrivateRoute adminOrCompliance><Brands /></PrivateRoute>} />
      <Route path="/merchants" element={<PrivateRoute adminOrCompliance><Merchants /></PrivateRoute>} />
      
      {/* Admin-only routes */}
      <Route path="/users" element={<PrivateRoute adminOnly><Users /></PrivateRoute>} />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" toastOptions={{ duration: 3000 }} />
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
