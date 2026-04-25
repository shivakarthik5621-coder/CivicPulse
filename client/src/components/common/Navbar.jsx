import { Link, useLocation } from 'react-router-dom';
import { useCitizenAuth } from '../../context/CitizenAuthContext';
import { Activity, BarChart3, Menu, X, User, LogOut, Camera, Search } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { citizen, isAuthenticated, logout } = useCitizenAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Don't render citizen navbar on admin pages
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 50,
      background: 'rgba(15, 23, 42, 0.9)', backdropFilter: 'blur(16px)',
      borderBottom: '1px solid var(--border)', padding: '0 24px'
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', height: 64
      }}>
        {/* Logo */}
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)',
          textDecoration: 'none'
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Activity size={20} color="white" />
          </div>
          <span>Civic<span style={{ color: 'var(--primary-light)' }}>Pulse</span></span>
        </Link>

        {/* Desktop Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} className="desktop-nav">
          <NavLink to="/" current={location.pathname} label="Home" />
          <NavLink to="/report" current={location.pathname} label="Report Issue" icon={<Camera size={15} />} />
          <NavLink to="/track" current={location.pathname} label="Track" icon={<Search size={15} />} />
          <NavLink to="/analytics" current={location.pathname} label="Analytics" icon={<BarChart3 size={15} />} />

          <div style={{ width: 1, height: 24, background: 'var(--border)', margin: '0 8px' }} />

          {isAuthenticated ? (
            <>
              <Link to="/profile" style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
                borderRadius: 8, fontSize: '0.9rem', fontWeight: 500,
                color: location.pathname === '/profile' ? 'var(--primary-light)' : 'var(--text-secondary)',
                background: location.pathname === '/profile' ? 'rgba(79,70,229,0.1)' : 'transparent',
                textDecoration: 'none', transition: 'all 0.2s ease'
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, color: 'white'
                }}>
                  {(citizen?.name || citizen?.email || 'U')[0].toUpperCase()}
                </div>
                {citizen?.name || 'Profile'}
              </Link>
              <button onClick={logout} className="btn btn-sm btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <LogOut size={14} /> Logout
              </button>
            </>
          ) : (
            <Link to="/login" className="btn btn-sm btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <User size={14} /> Login
            </Link>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button onClick={() => setMobileOpen(!mobileOpen)}
          style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', padding: 8 }}
          className="mobile-toggle">
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div style={{ padding: '16px 0', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 4 }} className="mobile-nav">
          <MobileNavLink to="/" label="Home" onClick={() => setMobileOpen(false)} />
          <MobileNavLink to="/report" label="Report Issue" onClick={() => setMobileOpen(false)} />
          <MobileNavLink to="/track" label="Track Complaint" onClick={() => setMobileOpen(false)} />
          <MobileNavLink to="/analytics" label="Analytics" onClick={() => setMobileOpen(false)} />
          {isAuthenticated ? (
            <>
              <MobileNavLink to="/profile" label="My Profile" onClick={() => setMobileOpen(false)} />
              <button onClick={() => { logout(); setMobileOpen(false); }}
                style={{ padding: '12px 16px', background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', textAlign: 'left', fontSize: '0.95rem', fontFamily: 'inherit' }}>
                Logout
              </button>
            </>
          ) : (
            <MobileNavLink to="/login" label="Login / Register" onClick={() => setMobileOpen(false)} />
          )}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-nav { display: none !important; }
        }
      `}</style>
    </nav>
  );
}

function NavLink({ to, current, label, icon }) {
  const isActive = to === '/' ? current === '/' : current.startsWith(to);
  return (
    <Link to={to} style={{
      padding: '8px 14px', borderRadius: 8, fontSize: '0.9rem', fontWeight: 500,
      color: isActive ? 'var(--primary-light)' : 'var(--text-secondary)',
      background: isActive ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
      display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s ease', textDecoration: 'none'
    }}>
      {icon} {label}
    </Link>
  );
}

function MobileNavLink({ to, label, onClick }) {
  return <Link to={to} onClick={onClick} style={{ padding: '12px 16px', fontSize: '0.95rem', color: 'var(--text-primary)', borderRadius: 8, textDecoration: 'none', display: 'block' }}>{label}</Link>;
}
