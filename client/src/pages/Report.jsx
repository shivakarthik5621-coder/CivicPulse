import { useState, useRef, useCallback } from 'react';
import { Camera, MapPin, Upload, X, Loader, CheckCircle, AlertTriangle, ChevronRight, Copy, Share2, Search } from 'lucide-react';
import { submitIssue } from '../services/api';
import imageCompression from 'browser-image-compression';



export default function Report() {
  const [step, setStep] = useState(1); // 1: Photo, 2: Location, 3: Review, 4: Success
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [location, setLocation] = useState(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [description, setDescription] = useState('');

  const [aiResult, setAiResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Handle photo selection
  const handlePhoto = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Compress image
      const compressed = await imageCompression(file, {
        maxSizeMB: 2, maxWidthOrHeight: 1200, useWebWorker: true
      });
      setPhoto(compressed);
      setPhotoPreview(URL.createObjectURL(compressed));
      setStep(2);
      // Auto-detect GPS
      detectLocation();
    } catch (err) {
      setError('Failed to process image. Please try again.');
    }
  }, []);

  // Detect GPS location
  const detectLocation = useCallback(() => {
    setLocationLoading(true);
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser.');
      setLocationLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationLoading(false);
        setStep(3);
      },
      (err) => {
        setLocationError('Unable to detect location. Please select your city below.');
        setLocationLoading(false);
        // Stay on step 2 — user must pick city manually
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Handle manual location (fallback)
  const handleManualLocation = (city) => {
    const cityCoords = {
      'Delhi': { lat: 28.6139, lng: 77.2090 },
      'Mumbai': { lat: 19.0760, lng: 72.8777 },
      'Bengaluru': { lat: 12.9716, lng: 77.5946 },
      'Chennai': { lat: 13.0827, lng: 80.2707 },
      'Hyderabad': { lat: 17.3850, lng: 78.4867 },
      'Kolkata': { lat: 22.5726, lng: 88.3639 },
      'Pune': { lat: 18.5204, lng: 73.8567 },
      'Jaipur': { lat: 26.9124, lng: 75.7873 },
    };
    setLocation(cityCoords[city] || cityCoords['Delhi']);
    setStep(3);
  };

  // Submit the issue
  const handleSubmit = async () => {
    if (!photo || !location) {
      setError('Photo and location are required.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('photo', photo);
      formData.append('latitude', location.lat);
      formData.append('longitude', location.lng);
      if (description) formData.append('description', description);

      const data = await submitIssue(formData);
      setResult(data);
      setAiResult({ category: data.ai_category, confidence: data.ai_confidence });
      setStep(4);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyTicketId = () => {
    if (result?.ticket_id) {
      navigator.clipboard.writeText(result.ticket_id);
    }
  };

  return (
    <div style={{ minHeight: 'calc(100vh - 64px)', padding: '40px 24px' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Progress Steps */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
          {['Photo', 'Location', 'Review', 'Done'].map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.8rem', fontWeight: 700,
                background: step > i + 1 ? 'var(--secondary)' : step === i + 1 ? 'var(--primary)' : 'var(--bg-hover)',
                color: step >= i + 1 ? 'white' : 'var(--text-muted)',
                transition: 'all 0.3s ease'
              }}>
                {step > i + 1 ? <CheckCircle size={16} /> : i + 1}
              </div>
              <span style={{
                fontSize: '0.8rem', fontWeight: 500,
                color: step === i + 1 ? 'var(--text-primary)' : 'var(--text-muted)',
                display: 'none'
              }} className="step-label">{label}</span>
              {i < 3 && <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />}
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: 20,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--danger-light)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {/* Step 1: Photo Capture */}
        {step === 1 && (
          <div className="glass-card animate-fade-in-up" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: 20, margin: '0 auto 24px',
              background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(16,185,129,0.1))',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <Camera size={36} color="var(--primary-light)" />
            </div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Take a Photo</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 32, fontSize: '0.95rem' }}>
              Capture or upload a photo of the civic issue
            </p>

            <input type="file" accept="image/*" capture="environment" ref={fileInputRef}
              onChange={handlePhoto} style={{ display: 'none' }} />

            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary btn-lg" onClick={() => fileInputRef.current?.click()}>
                <Camera size={20} /> Take Photo
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = 'image/*';
                input.onchange = handlePhoto; input.click();
              }}>
                <Upload size={20} /> Upload
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Location */}
        {step === 2 && (
          <div className="glass-card animate-fade-in-up" style={{ padding: 32 }}>
            {photoPreview && (
              <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24, position: 'relative' }}>
                <img src={photoPreview} alt="Issue" style={{ width: '100%', maxHeight: 300, objectFit: 'cover' }} />
                <button onClick={() => { setStep(1); setPhoto(null); setPhotoPreview(null); }}
                  style={{
                    position: 'absolute', top: 8, right: 8, width: 32, height: 32,
                    borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none',
                    color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                  <X size={16} />
                </button>
              </div>
            )}

            <div style={{ textAlign: 'center' }}>
              <MapPin size={28} color="var(--secondary)" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Detecting Location...</h3>

              {locationLoading && <div className="spinner" style={{ margin: '24px auto' }} />}

              {locationError && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ color: 'var(--accent)', fontSize: '0.9rem', marginBottom: 16 }}>{locationError}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: 12 }}>Select your city:</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {['Delhi', 'Mumbai', 'Bengaluru', 'Chennai', 'Hyderabad', 'Kolkata', 'Pune', 'Jaipur'].map(city => (
                      <button key={city} className="btn btn-secondary btn-sm" onClick={() => handleManualLocation(city)}>
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {location && !locationLoading && (
                <div style={{ marginTop: 16 }}>
                  <p style={{ color: 'var(--secondary-light)', fontWeight: 600 }}>📍 Location captured!</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 4 }}>
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <div className="glass-card animate-fade-in-up" style={{ padding: 32 }}>
            {photoPreview && (
              <div style={{ borderRadius: 'var(--radius)', overflow: 'hidden', marginBottom: 24 }}>
                <img src={photoPreview} alt="Issue" style={{ width: '100%', maxHeight: 250, objectFit: 'cover' }} />
              </div>
            )}

            {location && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, background: 'rgba(16,185,129,0.1)',
                border: '1px solid rgba(16,185,129,0.2)', marginBottom: 20,
                fontSize: '0.85rem', color: 'var(--secondary-light)', display: 'flex', alignItems: 'center', gap: 8
              }}>
                <MapPin size={14} /> Location: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </div>
            )}

            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius)', marginBottom: 20,
              background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)',
              fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 10
            }}>
              <span style={{ fontSize: '1.2rem' }}>🤖</span>
              <span style={{ color: 'var(--text-secondary)' }}>AI will auto-classify your issue on submission</span>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label className="form-label">Description (optional, max 200 chars)</label>
              <textarea className="form-input" placeholder="Briefly describe the issue..."
                value={description} onChange={e => setDescription(e.target.value.slice(0, 200))}
                rows={3} />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {description.length}/200
              </div>
            </div>

            <button className="btn btn-success btn-lg" style={{ width: '100%' }}
              onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><Loader size={18} className="spinning" /> Submitting...</> : <><CheckCircle size={18} /> Submit Report</>}
            </button>
          </div>
        )}

        {/* Step 4: Success */}
        {step === 4 && result && (
          <div className="glass-card animate-fade-in-up" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 24px',
              background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <CheckCircle size={40} color="var(--secondary)" />
            </div>

            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 8 }}>Issue Reported!</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>Your complaint has been recorded and will be reviewed by authorities.</p>

            <div style={{
              padding: '20px', borderRadius: 'var(--radius)', background: 'var(--bg-primary)',
              border: '1px solid var(--border)', marginBottom: 20
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>Your Ticket ID</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--primary-light)', letterSpacing: '0.03em' }}>
                {result.ticket_id}
              </div>
            </div>

            {result.ai_category && (
              <div style={{
                padding: '12px 16px', borderRadius: 8, marginBottom: 20,
                background: 'rgba(79,70,229,0.1)', border: '1px solid rgba(79,70,229,0.2)',
                fontSize: '0.9rem'
              }}>
                🤖 AI Detected: <strong>{result.ai_category.replace('_', ' ')}</strong> — {result.ai_confidence}% confident
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={copyTicketId}>
                <Copy size={16} /> Copy Ticket ID
              </button>
              <a href={`/track/${result.ticket_id}`} className="btn btn-primary">
                <Search size={16} /> Track Status
              </a>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .spinning { animation: spin 1s linear infinite; }
        @media (min-width: 640px) { .step-label { display: inline !important; } }
      `}</style>
    </div>
  );
}
