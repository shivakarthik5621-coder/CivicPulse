import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Clock, CheckCircle, AlertTriangle, Loader, Copy, Share2, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { trackIssue, reactToIssue } from '../services/api';
import { useCitizenAuth } from '../context/CitizenAuthContext';

const STATUS_STEPS = [
  { key: 'pending', label: 'Pending', color: '#fbbf24' },
  { key: 'assigned', label: 'Assigned', color: '#60a5fa' },
  { key: 'in_progress', label: 'In Progress', color: '#c084fc' },
  { key: 'resolved', label: 'Resolved', color: '#34d399' },
];

// ─── Before/After Photo Comparison ─────────────────────────────────────────
function BeforeAfterComparison({ beforeUrl, afterUrl }) {
  const [slider, setSlider] = useState(50);
  const [dragging, setDragging] = useState(false);

  const handleMove = (clientX, rect) => {
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    setSlider(Math.round((x / rect.width) * 100));
  };

  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Before & After</div>
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>← drag to compare →</div>
      </div>

      <div
        style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', cursor: 'col-resize', userSelect: 'none', height: 240 }}
        onMouseDown={(e) => {
          setDragging(true);
          const rect = e.currentTarget.getBoundingClientRect();
          handleMove(e.clientX, rect);
        }}
        onMouseMove={(e) => {
          if (!dragging) return;
          const rect = e.currentTarget.getBoundingClientRect();
          handleMove(e.clientX, rect);
        }}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
        onTouchStart={(e) => {
          setDragging(true);
          const rect = e.currentTarget.getBoundingClientRect();
          handleMove(e.touches[0].clientX, rect);
        }}
        onTouchMove={(e) => {
          if (!dragging) return;
          const rect = e.currentTarget.getBoundingClientRect();
          handleMove(e.touches[0].clientX, rect);
        }}
        onTouchEnd={() => setDragging(false)}
      >
        {/* After (full) */}
        <img src={afterUrl} alt="After fix"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />

        {/* Before (clipped) */}
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: `${slider}%` }}>
          <img src={beforeUrl} alt="Before fix"
            style={{ width: `${10000 / slider}%`, maxWidth: 'none', height: '100%', objectFit: 'cover' }} />
        </div>

        {/* Divider line */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: `${slider}%`,
          width: 3, background: 'white', transform: 'translateX(-50%)',
          boxShadow: '0 0 8px rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%', background: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#1e293b', fontSize: '0.9rem', fontWeight: 700
          }}>⟺</div>
        </div>

        {/* Labels */}
        <div style={{
          position: 'absolute', top: 10, left: 10,
          background: 'rgba(0,0,0,0.65)', color: 'white',
          fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4
        }}>📷 BEFORE</div>
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'rgba(16,185,129,0.85)', color: 'white',
          fontSize: '0.7rem', fontWeight: 700, padding: '3px 8px', borderRadius: 4
        }}>✅ AFTER</div>
      </div>
    </div>
  );
}

// ─── Citizen Reaction Panel ─────────────────────────────────────────────────
function CitizenReactionPanel({ issue, citizenId, onReacted }) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Only show for the original reporter, on resolved issues, without prior reaction
  if (!citizenId || issue.citizen_id_match === false) return null;
  if (issue.status !== 'resolved') return null;
  if (issue.citizen_reaction) {
    const labels = {
      confirmed: { icon: '✅', text: 'You confirmed the fix. Thank you!', color: '#34d399' },
      disputed: { icon: '⚠️', text: 'You reported the issue persists. Authorities have been notified.', color: '#f87171' },
      no_change: { icon: '😐', text: 'You noted no visible change.', color: 'var(--text-muted)' },
    };
    const r = labels[issue.citizen_reaction];
    return (
      <div className="glass-card" style={{
        padding: 20, marginBottom: 20,
        background: issue.citizen_reaction === 'confirmed' ? 'rgba(16,185,129,0.08)' :
                    issue.citizen_reaction === 'disputed' ? 'rgba(239,68,68,0.08)' : 'var(--bg-card)',
        border: `1px solid ${issue.citizen_reaction === 'confirmed' ? 'rgba(16,185,129,0.3)' :
                              issue.citizen_reaction === 'disputed' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`
      }}>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: r.color, marginBottom: 4 }}>
          {r.icon} {r.text}
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Your verification has been recorded.</div>
      </div>
    );
  }

  const handleReact = async (reaction) => {
    setSubmitting(true);
    setError('');
    try {
      await reactToIssue(issue.ticket_id, reaction);
      onReacted(reaction);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card" style={{
      padding: 24, marginBottom: 20,
      background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(79,70,229,0.05))',
      border: '1px solid rgba(16,185,129,0.25)'
    }}>
      <div style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 6 }}>
        🔍 Was the issue actually fixed?
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20, lineHeight: 1.6 }}>
        The municipal team has marked this as resolved. Please visit the location and let us know if the work was actually done.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          disabled={submitting}
          onClick={() => handleReact('confirmed')}
          className="btn"
          style={{
            flex: 1, minWidth: 120, padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.1))',
            border: '1px solid rgba(16,185,129,0.4)', color: '#34d399',
            fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <ThumbsUp size={16} /> Yes, fixed!
        </button>

        <button
          disabled={submitting}
          onClick={() => handleReact('disputed')}
          className="btn"
          style={{
            flex: 1, minWidth: 120, padding: '12px 16px',
            background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.08))',
            border: '1px solid rgba(239,68,68,0.35)', color: '#f87171',
            fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <ThumbsDown size={16} /> Still broken
        </button>

        <button
          disabled={submitting}
          onClick={() => handleReact('no_change')}
          className="btn"
          style={{
            flex: 1, minWidth: 120, padding: '12px 16px',
            background: 'var(--bg-hover)',
            border: '1px solid var(--border)', color: 'var(--text-muted)',
            fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
          }}
        >
          <Minus size={16} /> No change
        </button>
      </div>

      {submitting && (
        <div style={{ textAlign: 'center', marginTop: 12, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
          <Loader size={14} className="spinning" style={{ display: 'inline' }} /> Submitting your reaction...
        </div>
      )}
      {error && (
        <div style={{ marginTop: 10, color: 'var(--danger-light)', fontSize: '0.82rem' }}>{error}</div>
      )}
    </div>
  );
}

// ─── Main Track Page ─────────────────────────────────────────────────────────
export default function Track() {
  const { ticketId: paramTicketId } = useParams();
  const navigate = useNavigate();
  const { citizen } = useCitizenAuth();
  const [ticketId, setTicketId] = useState(paramTicketId || '');
  const [issue, setIssue] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (paramTicketId) fetchIssue(paramTicketId);
  }, [paramTicketId]);

  const fetchIssue = async (id) => {
    setLoading(true);
    setError('');
    try {
      const data = await trackIssue(id);
      setIssue(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Issue not found. Please check your ticket ID.');
      setIssue(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (ticketId.trim()) {
      navigate(`/track/${ticketId.trim()}`);
      fetchIssue(ticketId.trim());
    }
  };

  const getStatusIndex = (status) => {
    if (status === 'invalid' || status === 'disputed') return -1;
    return STATUS_STEPS.findIndex(s => s.key === status);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const isOwnIssue = citizen && issue && issue.citizen_id !== undefined
    ? issue.citizen_id === citizen.id
    : false;
  // citizen_id isn't exposed in public track API — so we match via citizen's own issues
  // The API returns citizen_id for own issues only if logged in (check CitizenAuthContext)

  const handleReacted = (reaction) => {
    setIssue(prev => ({ ...prev, citizen_reaction: reaction }));
  };

  const deadlineInfo = issue?.deadline_at && !['resolved', 'invalid'].includes(issue.status) ? (() => {
    const diff = new Date(issue.deadline_at) - Date.now();
    if (diff <= 0) return { text: 'Deadline passed', color: '#ef4444', overdue: true };
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return {
      text: days > 0 ? `${days}d ${hours}h remaining` : `${hours}h remaining`,
      color: diff < 24 * 60 * 60 * 1000 ? '#ef4444' : diff < 48 * 60 * 60 * 1000 ? '#fbbf24' : '#34d399',
      overdue: false
    };
  })() : null;

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 660, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 8 }}>
            Track Your <span style={{ color: 'var(--primary-light)' }}>Complaint</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Enter your ticket ID to check the current status</p>
        </div>

        {/* Search Box */}
        <form onSubmit={handleSearch} style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <input type="text" className="form-input" placeholder="Enter Ticket ID (e.g. CP-2026-10001)"
              value={ticketId} onChange={e => setTicketId(e.target.value.toUpperCase())}
              style={{ flex: 1, fontSize: '1.05rem', fontWeight: 600, letterSpacing: '0.02em' }} />
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <Loader size={18} className="spinning" /> : <Search size={18} />}
            </button>
          </div>
        </form>

        {error && (
          <div className="glass-card" style={{ padding: 24, textAlign: 'center', color: 'var(--danger-light)' }}>
            <AlertTriangle size={32} style={{ marginBottom: 12 }} />
            <p>{error}</p>
          </div>
        )}

        {loading && !issue && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div className="spinner" style={{ margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--text-muted)' }}>Fetching issue details...</p>
          </div>
        )}

        {issue && (
          <div className="animate-fade-in-up">
            {/* Disputed Banner */}
            {issue.status === 'disputed' && (
              <div style={{
                padding: '16px 20px', borderRadius: 'var(--radius)', marginBottom: 20,
                background: 'linear-gradient(135deg,rgba(249,115,22,0.15),rgba(249,115,22,0.05))',
                border: '1px solid rgba(249,115,22,0.4)', textAlign: 'center'
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🚨</div>
                <div style={{ fontWeight: 700, color: '#f97316', fontSize: '1.1rem', marginBottom: 4 }}>
                  Your Dispute Has Been Escalated
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                  Senior municipal authorities have been notified and will re-investigate this issue.
                  You will receive an email update when the status changes.
                </div>
              </div>
            )}

            {/* Resolved Banner */}
            {issue.status === 'resolved' && (
              <div style={{
                padding: '16px 20px', borderRadius: 'var(--radius)', marginBottom: 20,
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
                border: '1px solid rgba(16,185,129,0.3)', textAlign: 'center'
              }}>
                <CheckCircle size={28} color="var(--secondary)" style={{ marginBottom: 8 }} />
                <div style={{ fontWeight: 700, color: 'var(--secondary-light)', fontSize: '1.1rem' }}>
                  Issue Resolved! 🎉
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Resolved on {formatDate(issue.resolved_at)}
                </div>
              </div>
            )}

            {/* Citizen Reaction (for reporter of resolved issue) */}
            <CitizenReactionPanel
              issue={issue}
              citizenId={citizen?.id}
              onReacted={handleReacted}
            />

            {/* Status Timeline */}
            <div className="glass-card" style={{ padding: 28, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  Status Timeline
                </h3>
                {deadlineInfo && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '4px 10px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700,
                    background: deadlineInfo.overdue ? 'rgba(239,68,68,0.15)' : 'rgba(0,0,0,0.2)',
                    border: `1px solid ${deadlineInfo.color}40`, color: deadlineInfo.color
                  }}>
                    <Clock size={12} />
                    {deadlineInfo.overdue ? '⚠️ OVERDUE' : deadlineInfo.text}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {STATUS_STEPS.map((step, i) => {
                  const currentIdx = getStatusIndex(issue.status);
                  const isComplete = i <= currentIdx;
                  const isCurrent = i === currentIdx;
                  return (
                    <div key={step.key} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isComplete ? step.color : 'var(--bg-hover)',
                          color: isComplete ? 'white' : 'var(--text-muted)',
                          transition: 'all 0.3s ease',
                          boxShadow: isCurrent ? `0 0 14px ${step.color}50` : 'none',
                          fontSize: '0.85rem', fontWeight: 700
                        }}>
                          {isComplete ? '✓' : i + 1}
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div style={{
                            width: 2, height: 32,
                            background: i < currentIdx ? step.color : 'var(--border)',
                            transition: 'background 0.3s ease'
                          }} />
                        )}
                      </div>
                      <div style={{ paddingTop: 6, paddingBottom: i < STATUS_STEPS.length - 1 ? 20 : 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.95rem', color: isComplete ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {step.label}
                        </div>
                        {isCurrent && (
                          <div style={{ fontSize: '0.8rem', color: step.color, marginTop: 2 }}>Current Status</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Before/After Comparison (if resolved with photo) */}
            {issue.status === 'resolved' && issue.photo_url && issue.resolved_photo_url && (
              <div className="glass-card" style={{ padding: 24, marginBottom: 20 }}>
                <BeforeAfterComparison
                  beforeUrl={issue.photo_url}
                  afterUrl={issue.resolved_photo_url}
                />
              </div>
            )}

            {/* Issue Info Card */}
            <div className="glass-card" style={{ padding: 28, marginBottom: 20 }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--text-secondary)' }}>
                Issue Details
              </h3>

              {/* Only before photo if no after photo yet */}
              {issue.photo_url && !issue.resolved_photo_url && (
                <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 20 }}>
                  <img src={issue.photo_url} alt="Issue" style={{ width: '100%', maxHeight: 280, objectFit: 'cover' }} />
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <InfoItem label="Ticket ID" value={issue.ticket_id} />
                <InfoItem label="Category" value={issue.category?.replace(/_/g, ' ')} capitalize />
                <InfoItem label="City" value={issue.city} />
                <InfoItem label="Ward" value={issue.ward} />
                <InfoItem label="Reported" value={formatDate(issue.created_at)} />
                <InfoItem label="Last Updated" value={formatDate(issue.updated_at)} />
              </div>

              {issue.ai_category && (
                <div style={{
                  marginTop: 16, padding: '10px 14px', borderRadius: 8,
                  background: 'rgba(79,70,229,0.08)', fontSize: '0.85rem'
                }}>
                  🤖 AI: <strong>{issue.ai_category.replace(/_/g, ' ')}</strong> — {issue.ai_confidence}% confident
                </div>
              )}

              {issue.description && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Description</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{issue.description}</p>
                </div>
              )}
            </div>

            {/* Share */}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => navigator.clipboard.writeText(window.location.href)}>
                <Copy size={14} /> Copy Link
              </button>
              <a href={`https://wa.me/?text=Track my civic complaint: ${window.location.href}`}
                target="_blank" rel="noreferrer" className="btn btn-secondary btn-sm">
                <Share2 size={14} /> Share on WhatsApp
              </a>
            </div>
          </div>
        )}
      </div>

      <style>{`.spinning { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}

function InfoItem({ label, value, capitalize }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: capitalize ? 'capitalize' : 'none' }}>
        {value || '—'}
      </div>
    </div>
  );
}
