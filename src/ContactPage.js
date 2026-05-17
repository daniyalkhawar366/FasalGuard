import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Mail, MapPin, Phone, Send, Satellite, ShieldCheck, Sprout, SunMedium } from 'lucide-react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app';

const supportCards = [
  {
    title: 'Satellite Intelligence',
    subtitle: 'Field-level crop monitoring',
    icon: Satellite,
    route: '/satellite-analysis',
  },
  {
    title: 'Soil Guidance',
    subtitle: 'Moisture and field health',
    icon: Sprout,
    route: '/soil-analysis',
  },
  {
    title: 'Weather Planning',
    subtitle: 'Forecast-driven action',
    icon: SunMedium,
    route: '/crop-prediction',
  },
];

export default function ContactPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('Satellite Analysis Inquiry');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    const handleClick = (event) => {
      if (!event.target.closest('.profileIcon')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSending(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message })
      });
      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message || 'Message sent successfully. We will reply shortly.');
        setName('');
        setEmail('');
        setSubject('Satellite Analysis Inquiry');
        setMessage('');
      } else {
        setError(data.error || data.message || 'Failed to send message.');
      }
    } catch (requestError) {
      setError('Unable to reach the support team right now. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#f6f8f4',
      color: '#0f172a',
      fontFamily: 'Inter, Arial, sans-serif',
    },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: 'rgba(246, 248, 244, 0.92)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
    },
    headerInner: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: '16px 24px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '16px',
      flexWrap: 'wrap',
    },
    brand: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontWeight: 800,
      letterSpacing: '-0.03em',
      color: '#0f3d2e',
      cursor: 'pointer',
      border: 'none',
      background: 'transparent',
      padding: 0,
    },
    nav: {
      display: 'flex',
      alignItems: 'center',
      gap: '22px',
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
    },
    navLink: {
      background: 'transparent',
      border: 'none',
      padding: 0,
      color: '#334155',
      fontSize: '0.95rem',
      cursor: 'pointer',
      fontWeight: 500,
    },
    accountBtn: {
      width: '36px',
      height: '36px',
      borderRadius: '999px',
      background: '#dbe7df',
      border: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#345b4a',
      cursor: 'pointer',
    },
    hero: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: '34px 24px 0',
    },
    heroPanel: {
      borderRadius: '28px',
      overflow: 'hidden',
      minHeight: '250px',
      position: 'relative',
      background: 'linear-gradient(135deg, #0b5135 0%, #08452d 100%)',
      boxShadow: '0 24px 52px rgba(15, 83, 50, 0.22)',
    },
    heroImage: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: 0.28,
    },
    heroOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(8, 45, 30, 0.28) 0%, rgba(8, 45, 30, 0.78) 100%)',
    },
    heroContent: {
      position: 'relative',
      zIndex: 2,
      padding: '42px 34px',
      maxWidth: '760px',
      color: '#fff',
    },
    eyebrow: {
      fontSize: '0.72rem',
      letterSpacing: '0.24em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.78)',
      fontWeight: 800,
      marginBottom: '14px',
    },
    heroTitle: {
      margin: 0,
      fontSize: 'clamp(2.2rem, 4vw, 4rem)',
      lineHeight: 1.05,
      letterSpacing: '-0.05em',
    },
    heroText: {
      marginTop: '14px',
      maxWidth: '640px',
      fontSize: '1.02rem',
      lineHeight: 1.75,
      color: 'rgba(255,255,255,0.84)',
    },
    main: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: '26px 24px 70px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.25fr) minmax(320px, 0.85fr)',
      gap: '24px',
      alignItems: 'start',
    },
    card: {
      background: '#fff',
      borderRadius: '22px',
      border: '1px solid rgba(148, 163, 184, 0.14)',
      boxShadow: '0 20px 40px rgba(15, 23, 42, 0.06)',
    },
    formCard: {
      padding: '26px',
    },
    sectionLabel: {
      fontSize: '0.7rem',
      fontWeight: 800,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: '#0f5132',
      marginBottom: '8px',
    },
    sectionTitle: {
      margin: 0,
      fontSize: '1.65rem',
      letterSpacing: '-0.04em',
    },
    sectionText: {
      margin: '10px 0 22px',
      color: '#475569',
      lineHeight: 1.7,
      fontSize: '0.98rem',
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '16px',
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    },
    fullWidth: {
      gridColumn: '1 / -1',
    },
    label: {
      fontSize: '0.85rem',
      fontWeight: 700,
      color: '#334155',
    },
    input: {
      width: '100%',
      borderRadius: '14px',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      padding: '14px 16px',
      fontSize: '0.98rem',
      outline: 'none',
      background: '#fff',
      color: '#0f172a',
      boxSizing: 'border-box',
    },
    textarea: {
      width: '100%',
      minHeight: '160px',
      resize: 'vertical',
      borderRadius: '16px',
      border: '1px solid rgba(148, 163, 184, 0.2)',
      padding: '16px',
      fontSize: '0.98rem',
      outline: 'none',
      background: '#fff',
      color: '#0f172a',
      boxSizing: 'border-box',
      fontFamily: 'inherit',
    },
    submit: {
      marginTop: '10px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      padding: '14px 18px',
      borderRadius: '14px',
      border: 'none',
      background: 'linear-gradient(135deg, #0f5132 0%, #0b6b45 100%)',
      color: '#fff',
      fontWeight: 800,
      cursor: 'pointer',
      width: 'fit-content',
      boxShadow: '0 12px 28px rgba(15, 81, 50, 0.24)',
    },
    contactStack: {
      display: 'grid',
      gap: '18px',
    },
    infoCard: {
      padding: '22px',
    },
    infoRows: {
      display: 'grid',
      gap: '14px',
      marginTop: '18px',
    },
    infoRow: {
      display: 'grid',
      gridTemplateColumns: '36px 1fr',
      gap: '12px',
      alignItems: 'start',
    },
    iconWrap: {
      width: '36px',
      height: '36px',
      borderRadius: '999px',
      background: '#e7f4ed',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#0f5132',
      flexShrink: 0,
    },
    infoTitle: {
      fontSize: '1.45rem',
      margin: 0,
      letterSpacing: '-0.03em',
    },
    infoText: {
      color: '#475569',
      lineHeight: 1.6,
      marginTop: '4px',
      fontSize: '0.95rem',
    },
    visualCard: {
      overflow: 'hidden',
      minHeight: '220px',
      position: 'relative',
    },
    visualImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    },
    visualOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(7, 20, 14, 0.1) 18%, rgba(7, 20, 14, 0.56) 100%)',
    },
    visualCaption: {
      position: 'absolute',
      left: '18px',
      right: '18px',
      bottom: '18px',
      color: '#fff',
    },
    visualCaptionTitle: {
      fontSize: '1.05rem',
      fontWeight: 800,
      marginBottom: '4px',
    },
    visualCaptionText: {
      fontSize: '0.9rem',
      lineHeight: 1.5,
      color: 'rgba(255,255,255,0.88)',
      maxWidth: '36ch',
    },
    supportGrid: {
      marginTop: '22px',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '16px',
    },
    supportCard: {
      overflow: 'hidden',
      minHeight: '150px',
      position: 'relative',
      borderRadius: '18px',
    },
    supportImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    },
    supportLabel: {
      position: 'absolute',
      left: '14px',
      right: '14px',
      bottom: '14px',
      color: '#fff',
      fontWeight: 800,
      fontSize: '0.92rem',
      textShadow: '0 2px 10px rgba(0,0,0,0.4)',
    },
    supportNote: {
      fontSize: '0.85rem',
      color: '#64748b',
      marginTop: '10px',
    },
    message: {
      marginTop: '14px',
      padding: '14px 16px',
      borderRadius: '14px',
      fontSize: '0.95rem',
      lineHeight: 1.6,
    },
    successMessage: {
      background: '#ecfdf5',
      color: '#065f46',
      border: '1px solid #bbf7d0',
    },
    errorMessage: {
      background: '#fef2f2',
      color: '#991b1b',
      border: '1px solid #fecaca',
    },
    footer: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: '0 24px 34px',
      color: '#64748b',
      display: 'flex',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
    },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <button type="button" style={styles.brand} onClick={() => navigate('/home')}>
            <Leaf size={22} />
            <span>FasalGuard</span>
          </button>
          <nav style={styles.nav}>
            <button type="button" style={styles.navLink} onClick={() => navigate('/about')}>About Us</button>
            <button type="button" style={styles.navLink} onClick={() => navigate('/services')}>Services</button>
            <button type="button" style={styles.navLink} onClick={() => navigate('/contact')}>Contact Us</button>
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className="profileIcon"
                style={styles.accountBtn}
                onClick={() => setShowDropdown((prev) => !prev)}
                aria-label="Account"
              >
                <ShieldCheck size={18} />
              </button>
              {showDropdown && (
                <div style={{ position: 'absolute', right: 0, top: '44px', background: '#fff', borderRadius: '14px', boxShadow: '0 18px 40px rgba(15,23,42,0.12)', minWidth: '160px', overflow: 'hidden', border: '1px solid rgba(148,163,184,0.15)' }}>
                  <button type="button" onClick={() => { setShowDropdown(false); navigate('/profile'); }} style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 14px', textAlign: 'left', cursor: 'pointer' }}>Account</button>
                  <button type="button" onClick={() => { setShowDropdown(false); navigate('/login'); }} style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 14px', textAlign: 'left', cursor: 'pointer' }}>Logout</button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      <section style={styles.hero}>
        <div style={styles.heroPanel}>
          <img src="/contact_bg.png" alt="FasalGuard agriculture technology" style={styles.heroImage} />
          <div style={styles.heroOverlay} />
          <div style={styles.heroContent}>
            <div style={styles.eyebrow}>Direct Inquiry</div>
            <h1 style={styles.heroTitle}>Connect with Intelligence</h1>
            <p style={styles.heroText}>
              Reach the FasalGuard team for satellite analysis, crop guidance, and deployment support. We keep the platform focused on farm decisions and the same backend services already powering the app.
            </p>
          </div>
        </div>
      </section>

      <main style={styles.main}>
        <div style={styles.grid}>
          <section style={{ ...styles.card, ...styles.formCard }}>
            <div style={styles.sectionLabel}>Direct Inquiry</div>
            <h2 style={styles.sectionTitle}>Send a Message</h2>
            <p style={styles.sectionText}>
              Use this form to contact FasalGuard about satellite analysis, weather support, or account questions. Replies are sent through the existing backend contact endpoint.
            </p>

            <form onSubmit={handleSubmit}>
              <div style={styles.formGrid}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="John Doe"
                    required
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="john@fasalguard.ai"
                    required
                    style={styles.input}
                  />
                </div>
                <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                  <label style={styles.label}>Subject</label>
                  <select value={subject} onChange={(event) => setSubject(event.target.value)} style={styles.input}>
                    <option>Satellite Analysis Inquiry</option>
                    <option>Crop Prediction Support</option>
                    <option>Soil Analysis Help</option>
                    <option>Deployment or Account Issue</option>
                  </select>
                </div>
                <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                  <label style={styles.label}>Message</label>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe your agricultural challenge and how FasalGuard can help..."
                    required
                    style={styles.textarea}
                  />
                </div>
              </div>

              {error && <div style={{ ...styles.message, ...styles.errorMessage }}>{error}</div>}
              {success && <div style={{ ...styles.message, ...styles.successMessage }}>{success}</div>}

              <button type="submit" disabled={sending} style={styles.submit}>
                {sending ? 'Sending...' : 'Send Inquiry'}
                <Send size={16} />
              </button>
            </form>
          </section>

          <aside style={styles.contactStack}>
            <section style={{ ...styles.card, ...styles.infoCard }}>
              <div style={styles.sectionLabel}>Our Headquarters</div>
              <h2 style={styles.infoTitle}>FasalGuard Support Desk</h2>
              <div style={styles.infoRows}>
                <div style={styles.infoRow}>
                  <div style={styles.iconWrap}><MapPin size={16} /></div>
                  <div>
                    <div style={styles.label}>Address</div>
                    <div style={styles.infoText}>Remote-first support for FasalGuard users across Pakistan and partner field teams.</div>
                  </div>
                </div>
                <div style={styles.infoRow}>
                  <div style={styles.iconWrap}><Mail size={16} /></div>
                  <div>
                    <div style={styles.label}>Support Email</div>
                    <div style={styles.infoText}>support@fasalguard.ai</div>
                  </div>
                </div>
                <div style={styles.infoRow}>
                  <div style={styles.iconWrap}><Phone size={16} /></div>
                  <div>
                    <div style={styles.label}>Hotline</div>
                    <div style={styles.infoText}>Available through the dashboard support flow</div>
                  </div>
                </div>
              </div>
            </section>

            <section style={{ ...styles.card, ...styles.visualCard }}>
              <img src="/contact_bg.png" alt="FasalGuard field intelligence map" style={styles.visualImage} />
              <div style={styles.visualOverlay} />
              <div style={styles.visualCaption}>
                <div style={styles.visualCaptionTitle}>Always on farm intelligence</div>
                <div style={styles.visualCaptionText}>Satellite data, crop insights, and weather context built around FasalGuard’s backend services.</div>
              </div>
            </section>
          </aside>
        </div>

        <section style={{ marginTop: '24px' }}>
          <div style={styles.sectionLabel}>FasalGuard Network</div>
          <h2 style={styles.sectionTitle}>Where our support focuses</h2>
          <p style={styles.sectionText}>We keep the contact page centered on the FasalGuard product and the regions we actively model and support.</p>

          <div style={styles.supportGrid}>
            {supportCards.map((card) => (
              <div key={card.title} style={{ ...styles.card, ...styles.supportCard }}>
                <div style={{ padding: '18px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e7f4ed', color: '#0f5132', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                    <card.icon size={18} />
                  </div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: '#0f172a', marginBottom: '6px' }}>{card.title}</div>
                  <div style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6 }}>{card.subtitle}</div>
                  <button type="button" onClick={() => navigate(card.route)} style={{ marginTop: '16px', border: 'none', background: 'transparent', color: '#0f5132', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                    Open <Send size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div style={styles.supportNote}>
            Need a demo or a deeper walkthrough? Use the form above and the team will route your request through the existing FasalGuard backend.
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <div style={{ fontWeight: 800, color: '#0f3d2e' }}>FasalGuard</div>
        <div>Empowering agriculture through satellite intelligence.</div>
      </footer>
    </div>
  );
}
