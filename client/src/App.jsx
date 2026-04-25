import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { CitizenAuthProvider, useCitizenAuth } from './context/CitizenAuthContext';
import Navbar from './components/common/Navbar';
import AdminNavbar from './components/common/AdminNavbar';
import Home from './pages/Home';
import Report from './pages/Report';
import Track from './pages/Track';
import Analytics from './pages/Analytics';
import Login from './pages/Login';
import Profile from './pages/Profile';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import './index.css';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useCitizenAuth();
  if (loading) return null;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppContent() {
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  return (
    <>
      {isAdminRoute ? <AdminNavbar /> : <Navbar />}
      <main style={{ flex: 1 }}>
        <Routes>
          {/* Citizen Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/report" element={<ProtectedRoute><Report /></ProtectedRoute>} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:ticketId" element={<Track />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Admin Routes (separate layout) */}
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </>
  );
}

function App() {
  return (
    <CitizenAuthProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </CitizenAuthProvider>
  );
}

export default App;

