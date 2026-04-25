import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useCitizenAuth } from '../context/CitizenAuthContext';
import { getCitizenIssues } from '../services/api';
import { User, MapPin, Clock, CheckCircle, AlertTriangle, Camera, Tag, ChevronRight, Loader } from 'lucide-react';

const STATUS_COLORS = {
  pending: '#fbbf24', assigned: '#60a5fa', in_progress: '#c084fc', resolved: '#34d399', invalid: '#6b7280'
};

export default function Profile() {
  const { citizen, isAuthenticated } = useCitizenAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    fetchMyIssues();
  }, [isAuthenticated]);

  const fetchMyIssues = async () => {
    try {
      const data = await getCitizenIssues();
      setIssues(data.issues || []);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = filter === 'all' ? issues : issues.filter(i => i.status === filter);

  const stats = {
    total: issues.length,
    pending: issues.filter(i => i.status === 'pending').length,
    resolved: issues.filter(i => i.status === 'resolved').length,
    active: issues.filter(i => ['assigned', 'in_progress'].includes(i.status)).length,
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  }) : '—';

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        {/* Profile Header */}
        <div className="glass-card" style={{ padding: '32px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', fontWeight: 800, color: 'white'
          }}>
            {(citizen?.name || 'U')[0].toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{citizen?.name || 'Citizen'}</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{citizen?.email}</p>
            {citizen?.phone && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>📱 {citizen.phone}</p>}
          </div>
          <Link to="/report" className="btn btn-primary">
            <Camera size={16} /> Report New Issue
          </Link>
        </div>

        {/* Stats */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginBottom: 24
        }}>
          <StatCard label="Total Reports" value={stats.total} color="var(--primary-light)" onClick={() => setFilter('all')} active={filter === 'all'} />
          <StatCard label="Pending" value={stats.pending} color="#fbbf24" onClick={() => setFilter('pending')} active={filter === 'pending'} />
          <StatCard label="In Progress" value={stats.active} color="#c084fc" onClick={() => setFilter('active')} active={filter === 'active'} />
          <StatCard label="Resolved" value={stats.resolved} color="#34d399" onClick={() => setFilter('resolved')} active={filter === 'resolved'} />
        </div>

        {/* Issues List */}
        <div>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>
            My Reports {filtered.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({filtered.length})</span>}
          </h2>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : filtered.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center' }}>
              <Camera size={40} color="var(--text-muted)" style={{ marginBottom: 16 }} />
              <h3 style={{ fontWeight: 600, marginBottom: 8 }}>No reports yet</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>
                {filter !== 'all' ? 'No issues with this status.' : 'Report your first civic issue to get started!'}
              </p>
              <Link to="/report" className="btn btn-primary">
                <Camera size={16} /> Report an Issue
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filtered.map(issue => (
                <Link to={`/track/${issue.ticket_id}`} key={issue.id} className="glass-card" style={{
                  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16,
                  textDecoration: 'none', cursor: 'pointer'
                }}>
                  {issue.photo_url && (
                    <img src={issue.photo_url} alt="" style={{
                      width: 64, height: 64, borderRadius: 10, objectFit: 'cover'
                    }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {issue.ticket_id}
                      </span>
                      <span className={`badge badge-${issue.status}`}>
                        {issue.status?.replace('_', ' ')}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, textTransform: 'capitalize' }}>
                        <Tag size={12} /> {issue.category?.replace(/_/g, ' ')}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} /> {issue.city}, {issue.ward}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={12} /> {formatDate(issue.created_at)}
                      </span>
                    </div>
                    {issue.description && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {issue.description}
                      </p>
                    )}
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color, onClick, active }) {
  return (
    <div onClick={onClick} className="glass-card" style={{
      padding: '16px 20px', cursor: 'pointer',
      border: active ? `1px solid ${color}` : '1px solid var(--border)',
      boxShadow: active ? `0 0 12px ${color}20` : 'var(--shadow)'
    }}>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{value}</div>
    </div>
  );
}
