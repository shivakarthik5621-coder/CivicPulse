import { Link } from 'react-router-dom';
import { Camera, MapPin, Search, ArrowRight, Shield, BarChart3, Zap, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Home() {
  return (
    <div>
      <HeroSection />
      <HowItWorks />
      <FeaturesGrid />
      <CTASection />
      <Footer />
    </div>
  );
}

function HeroSection() {
  return (
    <section className="gradient-hero" style={{ minHeight: '85vh', display: 'flex', alignItems: 'center', position: 'relative' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 24px', position: 'relative', zIndex: 2, width: '100%' }}>
        <div style={{ maxWidth: 720 }}>
          <div className="animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '6px 16px', borderRadius: 9999, fontSize: '0.8rem', fontWeight: 600,
              background: 'rgba(79, 70, 229, 0.2)', color: 'var(--primary-light)',
              border: '1px solid rgba(79, 70, 229, 0.3)', marginBottom: 24
            }}>
              <Zap size={14} /> Powered by AI • Built for India
            </span>
          </div>

          <h1 className="animate-fade-in-up" style={{
            fontSize: 'clamp(2.5rem, 6vw, 4rem)', fontWeight: 900,
            lineHeight: 1.1, marginBottom: 24, animationDelay: '0.2s',
            background: 'linear-gradient(135deg, #f1f5f9, #818cf8)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
          }}>
            Your City's Issues,<br />Solved in Real Time.
          </h1>

          <p className="animate-fade-in-up" style={{
            fontSize: '1.2rem', color: 'var(--text-secondary)', maxWidth: 560,
            marginBottom: 40, lineHeight: 1.7, animationDelay: '0.3s'
          }}>
            Report potholes and garbage dumps in 30 seconds.
            AI classifies it. Authorities act. You track resolution — all in real time.
          </p>

          <div className="animate-fade-in-up" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', animationDelay: '0.4s' }}>
            <Link to="/report" className="btn btn-primary btn-lg animate-pulse-glow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Camera size={20} /> Report an Issue <ArrowRight size={18} />
            </Link>
            <Link to="/track" className="btn btn-secondary btn-lg">
              <Search size={18} /> Track My Complaint
            </Link>
          </div>
        </div>


      </div>

      <style>{`
        @media (max-width: 1024px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </section>
  );
}

function FloatingCard({ icon, title, sub, delay }) {
  return (
    <div className="glass-card animate-fade-in-up" style={{
      padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14,
      minWidth: 260, animationDelay: delay
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10, background: 'rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>{icon}</div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sub}</div>
      </div>
    </div>
  );
}

function StatsBar() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/analytics`)
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(() => { });
  }, []);

  const items = [
    { label: 'Issues Reported', value: stats?.total || 0, icon: <AlertTriangle size={20} /> },
    { label: 'Issues Resolved', value: stats?.resolved || 0, icon: <CheckCircle size={20} /> },
    { label: 'Cities Active', value: stats?.civic_health?.length || 0, icon: <MapPin size={20} /> },
    { label: 'Avg Resolution', value: stats ? `${stats.avg_resolution_days || 0} days` : '-- days', icon: <Clock size={20} /> },
  ];

  return (
    <section style={{
      background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)'
    }}>
      <div style={{
        maxWidth: 1280, margin: '0 auto', padding: '32px 24px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24
      }}>
        {items.map((stat, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center' }}>
            <div style={{ color: 'var(--primary-light)' }}>{stat.icon}</div>
            <div>
              <AnimatedCounter value={stat.value} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function AnimatedCounter({ value }) {
  const [count, setCount] = useState(0);
  const isNumber = typeof value === 'number';

  useEffect(() => {
    if (!isNumber) return;
    const duration = 2000;
    const steps = 60;
    const increment = value / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) { setCount(value); clearInterval(timer); }
      else setCount(Math.floor(current));
    }, duration / steps);
    return () => clearInterval(timer);
  }, [value, isNumber]);

  return (
    <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
      {isNumber ? count.toLocaleString() : value}
    </div>
  );
}

function HowItWorks() {
  const steps = [
    { num: '01', icon: <Camera size={28} />, title: 'Snap a Photo', desc: 'Take a photo of any civic issue — pothole or garbage dump. GPS captures automatically.' },
    { num: '02', icon: <Zap size={28} />, title: 'AI Classifies', desc: 'Our AI instantly identifies the issue type with confidence scoring. No manual categorization needed.' },
    { num: '03', icon: <Search size={28} />, title: 'Track Resolution', desc: 'Get a unique ticket ID. Track your complaint from Pending to Resolved in real time.' },
  ];

  return (
    <section style={{ padding: '80px 24px' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: 12 }}>
            How It <span style={{ color: 'var(--primary-light)' }}>Works</span>
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: 500, margin: '0 auto' }}>
            Report a civic issue in under 30 seconds. No account needed.
          </p>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32
        }}>
          {steps.map((step, i) => (
            <div key={i} className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 16, margin: '0 auto 20px',
                background: 'linear-gradient(135deg, rgba(79,70,229,0.2), rgba(16,185,129,0.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--primary-light)'
              }}>{step.icon}</div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', marginBottom: 8, letterSpacing: '0.1em' }}>
                STEP {step.num}
              </div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 10 }}>{step.title}</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesGrid() {
  const features = [
    { icon: <Camera size={22} />, title: 'Photo Evidence', desc: 'Every report includes geo-tagged photo evidence for accountability' },
    { icon: <MapPin size={22} />, title: 'GPS Tracking', desc: 'Automatic location capture — no manual address entry needed' },
    { icon: <Zap size={22} />, title: 'AI Classification', desc: 'YOLOv11 classifies issues instantly with confidence scoring' },
    { icon: <Shield size={22} />, title: 'Admin Dashboard', desc: 'Real-time map with color-coded pins for municipal authorities' },
    { icon: <BarChart3 size={22} />, title: 'Civic Health Score', desc: 'Public accountability through ward-level performance metrics' },
    { icon: <Clock size={22} />, title: 'Real-Time Updates', desc: 'Track your complaint from submission to resolution' },
  ];

  return (
    <section style={{ padding: '60px 24px', background: 'var(--bg-secondary)' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2rem', fontWeight: 800, marginBottom: 48 }}>
          Built for <span style={{ color: 'var(--secondary-light)' }}>Impact</span>
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20
        }}>
          {features.map((f, i) => (
            <div key={i} style={{
              padding: '24px', borderRadius: 'var(--radius)', border: '1px solid var(--border)',
              background: 'var(--bg-primary)', display: 'flex', gap: 16, alignItems: 'flex-start',
              transition: 'border-color 0.3s ease'
            }}>
              <div style={{
                minWidth: 44, height: 44, borderRadius: 10,
                background: 'rgba(79,70,229,0.12)', color: 'var(--primary-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{f.icon}</div>
              <div>
                <h4 style={{ fontWeight: 700, marginBottom: 4, fontSize: '1rem' }}>{f.title}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section style={{ padding: '80px 24px', textAlign: 'center' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: 16 }}>
          Every Indian City Deserves a <span style={{ color: 'var(--primary-light)' }}>Civic Health Dashboard</span>
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: 32 }}>
          CivicPulse is that dashboard. Report your first issue today.
        </p>
        <Link to="/report" className="btn btn-primary btn-lg">
          <Camera size={20} /> Start Reporting <ArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer style={{
      padding: '32px 24px', borderTop: '1px solid var(--border)',
      textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem'
    }}>
      <p>CivicPulse — Smart City Public Works Feedback System</p>
      <p style={{ marginTop: 4 }}>Built with ❤️ for Indian cities</p>
    </footer>
  );
}
