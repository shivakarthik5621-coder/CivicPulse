import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Activity, BarChart3, Menu, X, Shield, LayoutDashboard, LogOut, Filter } from 'lucide-react';
import { useState } from 'react';

export default function AdminNavbar() {
  const { admin, logout } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)', padding: '0 24px'
    }}>
      <div style={{
        maxWidth: 1440, margin: '0 auto', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', height: 56
      }}>
        {/* Admin Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/admin/dashboard" style={{
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)',
            textDecoration: 'none'
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #dc2626, #f59e0b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Shield size={17} color="white" />
            </div>
            <span>CivicPulse <span style={{ color: '#f87171', fontSize: '0.75rem', fontWeight: 600, background: 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 6 }}>ADMIN</span></span>
          </Link>

          {/* Admin Nav Links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 16 }} className="admin-desktop-nav">
            <AdminNavLink to="/admin/dashboard" current={location.pathname} label="Dashboard" icon={<LayoutDashboard size={15} />} />
            <AdminNavLink to="/admin/analytics" current={location.pathname} label="Analytics" icon={<BarChart3 size={15} />} />
          </div>
        </div>

        {/* Right side — only show when logged in */}
        {admin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }} className="admin-desktop-nav">
            <div style={{
              padding: '4px 12px', borderRadius: 8, background: 'var(--bg-primary)',
              border: '1px solid var(--border)', fontSize: '0.8rem'
            }}>
              <span style={{ color: 'var(--text-muted)' }}>{admin?.role === 'super_admin' ? '🌐 All India' : `📍 ${admin?.city}`}</span>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{admin?.name || admin?.email}</span>
            </div>
            <button onClick={logout} className="btn btn-sm" style={{
              background: 'rgba(239,68,68,0.1)', color: '#f87171',
              border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 6
            }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        )}

        {/* Mobile toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)}
          style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 8 }}
          className="admin-mobile-toggle">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {mobileOpen && (
        <div style={{ padding: '12px 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }} className="admin-mobile-nav">
          <MobileLink to="/admin/dashboard" label="Dashboard" onClick={() => setMobileOpen(false)} />
          <MobileLink to="/admin/analytics" label="Analytics" onClick={() => setMobileOpen(false)} />
          <button onClick={() => { logout(); setMobileOpen(false); }}
            style={{ padding: '12px 16px', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', textAlign: 'left', fontSize: '0.95rem', fontFamily: 'inherit' }}>
            Logout
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .admin-desktop-nav { display: none !important; }
          .admin-mobile-toggle { display: block !important; }
        }
        @media (min-width: 769px) {
          .admin-mobile-nav { display: none !important; }
        }
      `}</style>
    </nav>
  );
}

function AdminNavLink({ to, current, label, icon }) {
  const isActive = current === to || (to !== '/admin' && current.startsWith(to));
  return (
    <Link to={to} style={{
      padding: '6px 12px', borderRadius: 8, fontSize: '0.85rem', fontWeight: 500,
      color: isActive ? '#f87171' : 'var(--text-secondary)',
      background: isActive ? 'rgba(239,68,68,0.1)' : 'transparent',
      display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s ease', textDecoration: 'none'
    }}>
      {icon} {label}
    </Link>
  );
}

function MobileLink({ to, label, onClick }) {
  return <Link to={to} onClick={onClick} style={{ padding: '12px 16px', fontSize: '0.95rem', color: 'var(--text-primary)', textDecoration: 'none', display: 'block' }}>{label}</Link>;
}
