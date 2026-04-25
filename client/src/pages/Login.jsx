import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCitizenAuth } from '../context/CitizenAuthContext';
import { User, Lock, Loader, AlertTriangle, Eye, EyeOff, ArrowRight, ShieldCheck } from 'lucide-react';
import { citizenRegister, citizenLogin, verifyOTP, resendOTP } from '../services/api';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [step, setStep] = useState(1); // 1: credentials, 2: OTP verify

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);

  const { login, isAuthenticated } = useCitizenAuth();
  const navigate = useNavigate();
  const otpRefs = useRef([]);

  if (isAuthenticated) {
    navigate('/profile');
    return null;
  }

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // ===== Step 1: Submit credentials =====
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) { setError('Email and password are required.'); return; }
    if (isRegister && !name) { setError('Name is required.'); return; }
    if (isRegister && password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (isRegister && !/[A-Z]/.test(password)) { setError('Password must include an uppercase letter.'); return; }
    if (isRegister && !/[0-9]/.test(password)) { setError('Password must include a number.'); return; }

    setLoading(true);
    try {
      let res;
      if (isRegister) {
        res = await citizenRegister({ name, email, phone, password });
      } else {
        res = await citizenLogin(email, password);
      }

      if (res.requires_otp) {
        setStep(2);
        setSuccess('OTP sent to your email. Check your inbox.');
        setCountdown(60);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
      } else if (res.token) {
        // Direct login (no OTP required)
        login(res.token, res.citizen);
        navigate('/profile');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  // ===== Step 2: OTP verification =====
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) otpRefs.current[index + 1]?.focus();
    if (newOtp.every(d => d) && newOtp.join('').length === 6) handleVerify(newOtp.join(''));
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (e) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(''));
      otpRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  const handleVerify = async (code) => {
    setLoading(true); setError(''); setSuccess('');
    try {
      const data = await verifyOTP(email, code);
      login(data.token, data.citizen);
      navigate('/profile');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid OTP.');
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    setLoading(true); setError('');
    try {
      await resendOTP(email);
      setSuccess('New OTP sent! Check your inbox.');
      setCountdown(60);
    } catch { setError('Failed to resend.'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: 'calc(100vh - 64px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '40px 24px'
    }}>
      <div className="glass-card animate-fade-in-up" style={{ padding: 40, width: '100%', maxWidth: 440 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, margin: '0 auto 16px',
            background: step === 2
              ? 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(79,70,229,0.1))'
              : 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(16,185,129,0.15))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.3s ease'
          }}>
            {step === 2 ? <ShieldCheck size={28} color="var(--secondary-light)" />
              : <User size={28} color="var(--primary-light)" />}
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
            {step === 2 ? 'Verify Your Email'
              : isRegister ? 'Create Account' : 'Welcome Back'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 4 }}>
            {step === 2
              ? <>Enter the 6-digit code sent to <span style={{ color: 'var(--primary-light)', fontWeight: 600 }}>{email}</span></>
              : isRegister ? 'Sign up with email verification' : 'Sign in with 2-factor authentication'}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: 20,
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--danger-light)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8
          }}><AlertTriangle size={16} /> {error}</div>
        )}
        {success && (
          <div style={{
            padding: '12px 16px', borderRadius: 'var(--radius)', marginBottom: 20,
            background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
            color: 'var(--secondary-light)', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 8
          }}><ShieldCheck size={16} /> {success}</div>
        )}

        {/* ===== Step 1: Credentials ===== */}
        {step === 1 && (
          <>
            <form onSubmit={handleSubmit}>
              {isRegister && (
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Full Name</label>
                  <input type="text" className="form-input" placeholder="Your full name"
                    value={name} onChange={e => setName(e.target.value)} autoFocus />
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label className="form-label">Email</label>
                <input type="email" className="form-input" placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)} autoFocus={!isRegister} />
              </div>

              {isRegister && (
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Phone (optional)</label>
                  <input type="tel" className="form-input" placeholder="+91 9876543210"
                    value={phone} onChange={e => setPhone(e.target.value)} />
                </div>
              )}

              <div style={{ marginBottom: 24 }}>
                <label className="form-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'} className="form-input"
                    placeholder={isRegister ? 'Min 6 characters' : '••••••••'}
                    style={{ paddingRight: 44 }}
                    value={password} onChange={e => setPassword(e.target.value)} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4
                    }}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
                {loading
                  ? <><Loader size={18} className="spinning" /> {isRegister ? 'Sending OTP...' : 'Verifying...'}</>
                  : <>{isRegister ? 'Register & Verify' : 'Sign In'} <ArrowRight size={18} /></>}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20 }}>
              <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
                style={{
                  background: 'none', border: 'none', color: 'var(--primary-light)',
                  cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'inherit'
                }}>
                {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
              </button>
            </div>


          </>
        )}

        {/* ===== Step 2: OTP Verification ===== */}
        {step === 2 && (
          <div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}
              onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input key={i} type="text" inputMode="numeric" maxLength={1}
                  ref={el => otpRefs.current[i] = el} value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  style={{
                    width: 48, height: 56, textAlign: 'center', fontSize: '1.5rem', fontWeight: 800,
                    borderRadius: 12, border: digit ? '2px solid var(--primary)' : '2px solid var(--border)',
                    background: 'var(--bg-primary)', color: 'var(--text-primary)',
                    outline: 'none', transition: 'border-color 0.2s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                  onBlur={e => { if (!digit) e.target.style.borderColor = 'var(--border)'; }}
                />
              ))}
            </div>

            {loading && (
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <Loader size={24} className="spinning" style={{ color: 'var(--primary-light)' }} />
              </div>
            )}

            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button onClick={handleResend} disabled={countdown > 0 || loading}
                style={{
                  background: 'none', border: 'none',
                  cursor: countdown > 0 ? 'default' : 'pointer',
                  color: countdown > 0 ? 'var(--text-muted)' : 'var(--primary-light)',
                  fontSize: '0.9rem', fontFamily: 'inherit'
                }}>
                {countdown > 0 ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
              </button>
            </div>

            <div style={{ textAlign: 'center', marginTop: 12 }}>
              <button onClick={() => { setStep(1); setOtp(['', '', '', '', '', '']); setError(''); setSuccess(''); }}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit'
                }}>
                ← Back to {isRegister ? 'register' : 'login'}
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`.spinning { animation: spin 1s linear infinite; }`}</style>
    </div>
  );
}
