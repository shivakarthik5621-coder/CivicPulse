import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAdminIssues, updateIssueStatus, markIssueInvalid, pingCityAdmin, resolveIssueWithPhoto } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Filter, X, CheckCircle, Clock, AlertTriangle, Loader, MapPin,
  RefreshCw, BarChart3, Bell, Send, Upload, Image, Timer, ChevronRight
} from 'lucide-react';

delete L.Icon.Default.prototype._getIconUrl;

const createIcon = (color) => new L.DivIcon({
  className: 'custom-marker',
  html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4)"></div>`,
  iconSize: [28, 28], iconAnchor: [14, 14], popupAnchor: [0, -14]
});

const MARKER_ICONS = {
  pending: createIcon('#ef4444'),
  assigned: createIcon('#f59e0b'),
  in_progress: createIcon('#a855f7'),
  resolved: createIcon('#22c55e'),
  disputed: createIcon('#f97316'),
  invalid: createIcon('#6b7280'),
};

const STATUS_OPTIONS = ['pending', 'assigned', 'in_progress'];
const DEADLINE_HOURS = 6 * 24; // 6 days

// ─── Deadline Timer Component ───────────────────────────────────────────────
function DeadlineTimer({ deadlineAt, status }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [urgency, setUrgency] = useState('normal'); // normal | warning | critical | overdue

  useEffect(() => {
    if (!deadlineAt || status === 'resolved' || status === 'invalid') return;

    const tick = () => {
      const now = Date.now();
      const deadline = new Date(deadlineAt).getTime();
      const diff = deadline - now;

      if (diff <= 0) {
        setTimeLeft('OVERDUE');
        setUrgency('overdue');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (diff < 12 * 60 * 60 * 1000) { setUrgency('critical'); }
      else if (diff < 48 * 60 * 60 * 1000) { setUrgency('warning'); }
      else { setUrgency('normal'); }

      if (days > 0) setTimeLeft(`${days}d ${hours}h left`);
      else if (hours > 0) setTimeLeft(`${hours}h ${mins}m left`);
      else setTimeLeft(`${mins}m left`);
    };

    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [deadlineAt, status]);

  if (!deadlineAt || status === 'resolved' || status === 'invalid') return null;

  const colors = {
    normal: { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#34d399' },
    warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', text: '#fbbf24' },
    critical: { bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)', text: '#f87171' },
    overdue: { bg: 'rgba(239,68,68,0.2)', border: 'rgba(239,68,68,0.6)', text: '#ef4444' },
  };
  const c = colors[urgency];

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 6, fontSize: '0.72rem', fontWeight: 700,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
    }}>
      <Timer size={11} />
      {urgency === 'overdue' ? '⚠️ OVERDUE' : timeLeft}
    </div>
  );
}

// ─── Resolve With Photo Modal ────────────────────────────────────────────────
function ResolveModal({ issue, onClose, onResolved }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file) { setError('Please upload a photo showing the issue is fixed.'); return; }
    setUploading(true);
    setError('');
    try {
      const data = await resolveIssueWithPhoto(issue.id, file, notes);
      onResolved(data.issue);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resolve. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
      zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      <div className="glass-card animate-fade-in-up" style={{ width: '100%', maxWidth: 480, padding: 28, position: 'relative' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 12, right: 12,
          background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
          color: 'var(--text-muted)', borderRadius: 6, padding: '4px 8px', cursor: 'pointer'
        }}>
          <X size={16} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10, background: 'rgba(16,185,129,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <CheckCircle size={20} color="#34d399" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Mark as Resolved</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{issue.ticket_id}</div>
          </div>
        </div>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
          Upload a photo of the fixed location as proof of resolution. This will be shown to the citizen for verification.
        </p>

        {/* Photo Upload Area */}
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${preview ? 'rgba(16,185,129,0.5)' : 'var(--border)'}`,
            borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
            marginBottom: 16, minHeight: 160, position: 'relative',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: preview ? 'transparent' : 'var(--bg-primary)',
            transition: 'border-color 0.2s'
          }}
        >
          {preview ? (
            <img src={preview} alt="Preview" style={{ width: '100%', maxHeight: 240, objectFit: 'cover', display: 'block' }} />
          ) : (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Upload size={32} color="var(--text-muted)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Click to upload resolution photo</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>JPG, PNG or WebP • Max 10MB</div>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        </div>

        {preview && (
          <button onClick={() => { setFile(null); setPreview(null); }}
            style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 12 }}>
            × Remove photo
          </button>
        )}

        <textarea
          className="form-input"
          placeholder="Optional note (e.g. 'Road repaired with asphalt patch')"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          style={{ marginBottom: 16, fontSize: '0.85rem' }}
        />

        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 8, marginBottom: 12,
            background: 'rgba(239,68,68,0.1)', color: 'var(--danger-light)',
            border: '1px solid rgba(239,68,68,0.2)', fontSize: '0.82rem'
          }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button className="btn btn-primary" style={{
            flex: 2, background: 'linear-gradient(135deg, #10b981, #059669)'
          }} onClick={handleSubmit} disabled={uploading}>
            {uploading
              ? <><Loader size={16} className="spinning" /> Uploading...</>
              : <><CheckCircle size={16} /> Confirm Resolution</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const { isAuthenticated, admin } = useAuth();
  const navigate = useNavigate();
  const [issues, setIssues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ status: '', category: '', city: '' });
  const [updating, setUpdating] = useState(false);
  const [pingMessage, setPingMessage] = useState('');
  const [pinging, setPinging] = useState(false);
  const [pingSuccess, setPingSuccess] = useState('');
  const [resolveModal, setResolveModal] = useState(null); // issue to resolve

  const isSuperAdmin = admin?.role === 'super_admin';

  const ROLE_LABELS = {
    super_admin: '🌐 All India',
    city_potholes: `📍 ${admin?.city} — Potholes`,
    city_garbage: `📍 ${admin?.city} — Garbage`,
  };
  const dashboardTitle = ROLE_LABELS[admin?.role] || `📍 ${admin?.city}`;

  useEffect(() => {
    if (!isAuthenticated) { navigate('/admin/login'); return; }
    fetchIssues();
  }, [isAuthenticated]);

  const fetchIssues = async () => {
    setLoading(true);
    try {
      const data = await getAdminIssues(filters);
      setIssues(data.issues || []);
    } catch (err) {
      console.error('Failed to fetch issues:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isAuthenticated) fetchIssues(); }, [filters]);

  const handleStatusUpdate = async (issueId, newStatus) => {
    if (newStatus === 'resolved') {
      // Open resolve modal — photo required
      const issue = issues.find(i => i.id === issueId);
      setResolveModal(issue);
      return;
    }
    setUpdating(true);
    try {
      await updateIssueStatus(issueId, { status: newStatus });
      setIssues(prev => prev.map(i =>
        i.id === issueId ? { ...i, status: newStatus, updated_at: new Date().toISOString() } : i
      ));
      if (selectedIssue?.id === issueId) {
        setSelectedIssue(prev => ({ ...prev, status: newStatus }));
      }
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleResolved = (updatedIssue) => {
    setIssues(prev => prev.map(i => i.id === updatedIssue.id ? updatedIssue : i));
    if (selectedIssue?.id === updatedIssue.id) setSelectedIssue(updatedIssue);
  };

  const handleMarkInvalid = async (issueId) => {
    setUpdating(true);
    try {
      await markIssueInvalid(issueId, 'Marked as invalid by admin');
      setIssues(prev => prev.map(i => i.id === issueId ? { ...i, status: 'invalid' } : i));
      setSelectedIssue(null);
    } catch (err) {
      console.error('Failed to mark invalid:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handlePing = async (issueId) => {
    setPinging(true);
    setPingSuccess('');
    try {
      const res = await pingCityAdmin(issueId, pingMessage || undefined);
      setPingSuccess(res.message || 'City admin notified!');
      setPingMessage('');
      setTimeout(() => setPingSuccess(''), 4000);
    } catch (err) {
      setPingSuccess('Failed to ping admin.');
    } finally {
      setPinging(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '—';

  const stats = {
    total: issues.length,
    pending: issues.filter(i => i.status === 'pending').length,
    inProgress: issues.filter(i => i.status === 'in_progress' || i.status === 'assigned').length,
    resolved: issues.filter(i => i.status === 'resolved').length,
    disputed: issues.filter(i => i.status === 'disputed').length,
    overdue: issues.filter(i =>
      i.deadline_at && new Date(i.deadline_at) < new Date() &&
      !['resolved', 'invalid', 'disputed'].includes(i.status)
    ).length,
  };

  const mapCenter = issues.length > 0
    ? [issues.reduce((s, i) => s + parseFloat(i.latitude), 0) / issues.length,
       issues.reduce((s, i) => s + parseFloat(i.longitude), 0) / issues.length]
    : [22.5, 78.9];

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Resolve Modal */}
      {resolveModal && (
        <ResolveModal
          issue={resolveModal}
          onClose={() => setResolveModal(null)}
          onResolved={handleResolved}
        />
      )}

      {/* Top Bar */}
      <div style={{
        padding: '12px 20px', background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{dashboardTitle} Dashboard</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <MiniStat label="Open" value={stats.pending} color="#fbbf24" />
            <MiniStat label="Active" value={stats.inProgress} color="#c084fc" />
            <MiniStat label="Resolved" value={stats.resolved} color="#34d399" />
            {stats.disputed > 0 && <MiniStat label="🚨 Disputed" value={stats.disputed} color="#f97316" />}
            {stats.overdue > 0 && <MiniStat label="⚠️ Overdue" value={stats.overdue} color="#f87171" />}
            <MiniStat label="Total" value={stats.total} color="var(--primary-light)" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter size={14} /> Filters
          </button>
          <button className="btn btn-secondary btn-sm" onClick={fetchIssues}>
            <RefreshCw size={14} /> Refresh
          </button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/analytics')}>
            <BarChart3 size={14} /> Analytics
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div style={{
          padding: '12px 20px', background: 'var(--bg-card)',
          borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, flexWrap: 'wrap'
        }}>
          <select className="form-input form-select" style={{ width: 'auto', padding: '8px 36px 8px 12px', fontSize: '0.85rem' }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Statuses</option>
            {['pending', 'assigned', 'in_progress', 'resolved', 'disputed'].map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <select className="form-input form-select" style={{ width: 'auto', padding: '8px 36px 8px 12px', fontSize: '0.85rem' }}
            value={filters.category} onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}>
            <option value="">All Categories</option>
            <option value="pothole">Pothole</option>
            <option value="garbage_dump">Garbage Dump</option>
          </select>
          <button className="btn btn-secondary btn-sm" onClick={() => setFilters({ status: '', category: '', city: '' })}>
            Clear
          </button>
        </div>
      )}

      {/* Content: Issue List + Map + Detail Panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Issue List */}
        <div style={{ width: 320, borderRight: '1px solid var(--border)', overflowY: 'auto', background: 'var(--bg-primary)' }}>
          {loading
            ? <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
            : issues.length === 0
              ? <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>No issues found</div>
              : issues.map(issue => (
                <div key={issue.id}
                  onClick={() => setSelectedIssue(issue)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', transition: 'background 0.15s',
                    background: selectedIssue?.id === issue.id ? 'var(--bg-hover)' : 'transparent'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{issue.ticket_id}</div>
                    <span className={`badge badge-${issue.status}`} style={{ fontSize: '0.65rem' }}>
                      {issue.status?.replace('_', ' ')}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginBottom: 4 }}>
                    {issue.category?.replace(/_/g, ' ')} • {issue.city}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {formatDate(issue.created_at)}
                    </div>
                    <DeadlineTimer deadlineAt={issue.deadline_at} status={issue.status} />
                  </div>
                  {/* Citizen reaction badge */}
                  {issue.citizen_reaction && (
                    <div style={{
                      marginTop: 4, fontSize: '0.7rem', padding: '2px 6px', borderRadius: 4, display: 'inline-block',
                      background: issue.citizen_reaction === 'confirmed' ? 'rgba(16,185,129,0.15)' :
                                  issue.citizen_reaction === 'disputed' ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)',
                      color: issue.citizen_reaction === 'confirmed' ? '#34d399' :
                             issue.citizen_reaction === 'disputed' ? '#f87171' : 'var(--text-muted)'
                    }}>
                      {issue.citizen_reaction === 'confirmed' ? '✅ Citizen confirmed' :
                       issue.citizen_reaction === 'disputed' ? '⚠️ Citizen disputed' : '😐 No change noted'}
                    </div>
                  )}
                </div>
              ))
          }
        </div>

        {/* Map */}
        <div style={{ flex: 1, position: 'relative' }}>
          <MapContainer center={mapCenter} zoom={10} style={{ width: '100%', height: '100%' }}>
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapBoundsUpdater issues={issues} />
            {issues.filter(i => i.latitude && i.longitude).map(issue => (
              <Marker key={issue.id}
                position={[parseFloat(issue.latitude), parseFloat(issue.longitude)]}
                icon={MARKER_ICONS[issue.status] || MARKER_ICONS.pending}
                eventHandlers={{ click: () => setSelectedIssue(issue) }}
              >
                <Popup>
                  <div style={{ minWidth: 160 }}>
                    <strong>{issue.ticket_id}</strong><br />
                    <span style={{ textTransform: 'capitalize' }}>{issue.category?.replace(/_/g, ' ')}</span><br />
                    <span>{issue.status?.replace('_', ' ')}</span>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map Legend */}
          <div style={{
            position: 'absolute', bottom: 20, left: 20, zIndex: 1000,
            background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(8px)',
            borderRadius: 'var(--radius)', padding: '12px 16px',
            border: '1px solid var(--border)', fontSize: '0.75rem'
          }}>
            <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-secondary)' }}>Legend</div>
            {[
              { color: '#ef4444', label: 'Pending' },
              { color: '#f59e0b', label: 'Assigned' },
              { color: '#a855f7', label: 'In Progress' },
              { color: '#22c55e', label: 'Resolved' },
              { color: '#f97316', label: 'Disputed' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: item.color }} />
                <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Issue Detail Panel */}
        {selectedIssue && (
          <div className="animate-slide-right" style={{
            width: 390, background: 'var(--bg-secondary)',
            borderLeft: '1px solid var(--border)', overflowY: 'auto', position: 'relative'
          }}>
            <button onClick={() => setSelectedIssue(null)} style={{
              position: 'absolute', top: 12, right: 12, zIndex: 10,
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <X size={16} />
            </button>

            {/* Before Photo */}
            {selectedIssue.photo_url && (
              <div style={{ position: 'relative' }}>
                <img src={selectedIssue.photo_url} alt="Issue"
                  style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', bottom: 8, left: 8,
                  background: 'rgba(0,0,0,0.7)', color: 'white',
                  fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4
                }}>📷 BEFORE</div>
              </div>
            )}

            {/* After Photo (if resolved) */}
            {selectedIssue.resolved_photo_url && (
              <div style={{ position: 'relative' }}>
                <img src={selectedIssue.resolved_photo_url} alt="Resolved"
                  style={{ width: '100%', height: 180, objectFit: 'cover' }} />
                <div style={{
                  position: 'absolute', bottom: 8, left: 8,
                  background: 'rgba(16,185,129,0.85)', color: 'white',
                  fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4
                }}>✅ AFTER</div>
              </div>
            )}

            <div style={{ padding: 20 }}>
              {/* Ticket & Status */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedIssue.ticket_id}</div>
                <span className={`badge badge-${selectedIssue.status}`}>
                  {selectedIssue.status?.replace('_', ' ')}
                </span>
              </div>

              {/* Deadline Timer */}
              <div style={{ marginBottom: 12 }}>
                <DeadlineTimer deadlineAt={selectedIssue.deadline_at} status={selectedIssue.status} />
                {selectedIssue.deadline_at && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    Deadline: {formatDate(selectedIssue.deadline_at)}
                  </div>
                )}
              </div>

              {/* Dispute Escalation Alert (super admin) */}
              {selectedIssue.status === 'disputed' && (
                <div style={{
                  padding: '14px 16px', borderRadius: 10, marginBottom: 14,
                  background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.4)'
                }}>
                  <div style={{ fontWeight: 700, color: '#f97316', fontSize: '0.9rem', marginBottom: 6 }}>
                    🚨 Citizen Disputed This Resolution
                  </div>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '0 0 10px', lineHeight: 1.5 }}>
                    The citizen reported the issue still exists after it was marked resolved.
                    This has been escalated to all super admins. Please re-investigate and update the status.
                  </p>
                  {isSuperAdmin && (
                    <button
                      className="btn btn-sm"
                      disabled={updating}
                      style={{
                        background: 'linear-gradient(135deg,#f97316,#ea580c)',
                        color: 'white', fontWeight: 700, fontSize: '0.82rem',
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                      onClick={() => handleStatusUpdate(selectedIssue.id, 'in_progress')}
                    >
                      🔧 Re-open for Re-investigation
                    </button>
                  )}
                </div>
              )}

              {/* Citizen Reaction */}
              {selectedIssue.citizen_reaction && (
                <div style={{
                  padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                  background: selectedIssue.citizen_reaction === 'confirmed' ? 'rgba(16,185,129,0.1)' :
                               selectedIssue.citizen_reaction === 'disputed' ? 'rgba(239,68,68,0.1)' : 'var(--bg-primary)',
                  border: `1px solid ${selectedIssue.citizen_reaction === 'confirmed' ? 'rgba(16,185,129,0.3)' :
                           selectedIssue.citizen_reaction === 'disputed' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 3 }}>Citizen Verification</div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color:
                    selectedIssue.citizen_reaction === 'confirmed' ? '#34d399' :
                    selectedIssue.citizen_reaction === 'disputed' ? '#f87171' : 'var(--text-secondary)'
                  }}>
                    {selectedIssue.citizen_reaction === 'confirmed' ? '✅ Citizen confirmed the fix' :
                     selectedIssue.citizen_reaction === 'disputed' ? '⚠️ Citizen says issue persists' :
                     '😐 Citizen noted no visible change'}
                  </div>
                </div>
              )}

              {/* Category */}
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                background: 'var(--bg-primary)', border: '1px solid var(--border)'
              }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Category</div>
                <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                  {selectedIssue.category?.replace(/_/g, ' ')}
                </div>
                {selectedIssue.ai_confidence && (
                  <div style={{ fontSize: '0.8rem', marginTop: 4 }}>
                    🤖 AI: <span className={
                      selectedIssue.ai_confidence >= 85 ? 'confidence-high' :
                      selectedIssue.ai_confidence >= 70 ? 'confidence-medium' : 'confidence-low'
                    }>{selectedIssue.ai_confidence}% confident</span>
                  </div>
                )}
              </div>

              {/* Location */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Location</div>
                <div style={{ fontWeight: 500 }}>{selectedIssue.city}, {selectedIssue.ward}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {selectedIssue.latitude}, {selectedIssue.longitude}
                </div>
              </div>

              {/* Timestamps */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Reported</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{formatDate(selectedIssue.created_at)}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Updated</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 500 }}>{formatDate(selectedIssue.updated_at)}</div>
                </div>
              </div>

              {selectedIssue.description && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Description</div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{selectedIssue.description}</p>
                </div>
              )}

              {/* Status Buttons (city admin only, non-resolved) */}
              {!isSuperAdmin && selectedIssue.status !== 'resolved' && selectedIssue.status !== 'invalid' && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>Update Status</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {STATUS_OPTIONS.map(status => (
                      <button key={status} disabled={updating || selectedIssue.status === status}
                        className={`btn btn-sm ${selectedIssue.status === status ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}
                        onClick={() => handleStatusUpdate(selectedIssue.id, status)}>
                        {status.replace('_', ' ')}
                      </button>
                    ))}
                    {/* Resolve — requires photo */}
                    <button
                      disabled={updating}
                      className="btn btn-sm"
                      style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: 'white', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 4
                      }}
                      onClick={() => setResolveModal(selectedIssue)}
                    >
                      <Image size={12} /> Resolve with Photo
                    </button>
                  </div>
                </div>
              )}

              {/* Ping City Admin (super admin) */}
              {isSuperAdmin && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Bell size={14} /> Ping City Admin
                  </div>
                  <textarea className="form-input" placeholder="Optional message..." value={pingMessage}
                    onChange={e => setPingMessage(e.target.value)} rows={2} style={{ marginBottom: 8, fontSize: '0.85rem' }} />
                  <button className="btn btn-primary btn-sm" style={{ width: '100%' }}
                    onClick={() => handlePing(selectedIssue.id)} disabled={pinging}>
                    {pinging ? <><Loader size={14} className="spinning" /> Sending...</> : <><Send size={14} /> Notify City Admin</>}
                  </button>
                  {pingSuccess && (
                    <div style={{
                      marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: '0.8rem',
                      background: pingSuccess.includes('Failed') ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                      color: pingSuccess.includes('Failed') ? 'var(--danger-light)' : 'var(--secondary-light)',
                      border: `1px solid ${pingSuccess.includes('Failed') ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`
                    }}>
                      {pingSuccess}
                    </div>
                  )}
                </div>
              )}

              {/* Mark Invalid */}
              {!isSuperAdmin && selectedIssue.status !== 'resolved' && selectedIssue.status !== 'invalid' && (
                <button className="btn btn-danger btn-sm" style={{ width: '100%' }}
                  onClick={() => handleMarkInvalid(selectedIssue.id)} disabled={updating}>
                  Mark Invalid
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div style={{
      padding: '4px 12px', borderRadius: 8, background: 'var(--bg-primary)',
      border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 6
    }}>
      <span style={{ fontSize: '1rem', fontWeight: 800, color }}>{value}</span>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function MapBoundsUpdater({ issues }) {
  const map = useMap();
  useEffect(() => {
    if (issues.length > 0) {
      const bounds = L.latLngBounds(
        issues.filter(i => i.latitude && i.longitude)
          .map(i => [parseFloat(i.latitude), parseFloat(i.longitude)])
      );
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
    }
  }, [issues, map]);
  return null;
}
