import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Leaf, Lock, MapPin, Save, ShieldCheck, User } from 'lucide-react';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app';

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [alerts, setAlerts] = useState({ satellite: true, anomaly: true, weather: false });

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetch(`${API_BASE}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.user) {
          setUser(data.user);
          setName(data.user.name || '');
        } else {
          localStorage.removeItem('token');
          navigate('/login');
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/login');
      })
      .finally(() => setLoading(false));
  }, [navigate]);

  useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (event) => {
      if (!event.target.closest('.profileIcon')) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  const handleSave = async () => {
    setSaveMsg('');
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }

    if (user?.provider !== 'google' && (currentPassword || newPassword || confirmPassword)) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setSaveMsg('Please fill all password fields.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setSaveMsg('New passwords do not match.');
        return;
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(newPassword)) {
        setSaveMsg('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
        return;
      }
    }

    try {
      const payload = user?.provider !== 'google' && (currentPassword || newPassword || confirmPassword)
        ? { name, currentPassword, newPassword }
        : { name };

      const response = await fetch(`${API_BASE}/api/auth/profile`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (data.success) {
        setUser(data.user);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setSaveMsg('Profile saved successfully.');
      } else {
        setSaveMsg(data.message || 'Unable to update profile.');
      }
    } catch {
      setSaveMsg('Unable to update profile right now.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const initials = (name || user?.email || 'F').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();

  const styles = {
    page: {
      height: '100vh',
      overflow: 'hidden',
      display: 'grid',
      gridTemplateRows: 'auto 1fr',
      background: 'linear-gradient(180deg, #f4f8f2 0%, #eef5ea 100%)',
      color: '#0f172a',
      fontFamily: 'Inter, Arial, sans-serif',
    },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: 'rgba(244, 248, 242, 0.95)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(148, 163, 184, 0.16)',
    },
    headerInner: {
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '14px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
    },
    brand: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      border: 'none',
      background: 'transparent',
      padding: 0,
      color: '#0f5132',
      cursor: 'pointer',
      fontWeight: 800,
      letterSpacing: '-0.03em',
      fontSize: '1.05rem',
    },
    nav: {
      display: 'flex',
      alignItems: 'center',
      gap: '22px',
      flexWrap: 'wrap',
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
      background: '#dcebe1',
      border: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#0f5132',
      cursor: 'pointer',
    },
    dropdown: {
      position: 'absolute',
      right: 0,
      top: '44px',
      background: '#fff',
      borderRadius: '14px',
      boxShadow: '0 18px 40px rgba(15,23,42,0.12)',
      minWidth: '160px',
      overflow: 'hidden',
      border: '1px solid rgba(148,163,184,0.15)',
    },
    main: {
      maxWidth: '1200px',
      width: '100%',
      margin: '0 auto',
      padding: '20px 24px 22px',
      boxSizing: 'border-box',
      minHeight: 0,
      overflow: 'hidden',
      display: 'grid',
      gap: '18px',
    },
    hero: {
      borderRadius: '24px',
      overflow: 'hidden',
      position: 'relative',
      minHeight: '170px',
      background: 'linear-gradient(135deg, #0b5135 0%, #08452d 100%)',
      boxShadow: '0 18px 40px rgba(15,81,50,0.16)',
    },
    heroImage: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: 0.24,
    },
    heroOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(8,45,30,0.18) 0%, rgba(8,45,30,0.78) 100%)',
    },
    heroText: {
      position: 'relative',
      zIndex: 2,
      padding: '22px 24px',
      color: '#fff',
      maxWidth: '760px',
    },
    kicker: {
      fontSize: '0.68rem',
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      opacity: 0.75,
      fontWeight: 800,
      marginBottom: '10px',
    },
    title: {
      margin: 0,
      fontSize: 'clamp(1.9rem, 3vw, 3rem)',
      letterSpacing: '-0.05em',
    },
    subtitle: {
      marginTop: '8px',
      fontSize: '0.96rem',
      lineHeight: 1.6,
      color: 'rgba(255,255,255,0.84)',
      maxWidth: '60ch',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
      gap: '16px',
      minHeight: 0,
      overflow: 'hidden',
    },
    card: {
      background: '#fff',
      borderRadius: '22px',
      border: '1px solid rgba(148,163,184,0.14)',
      boxShadow: '0 18px 34px rgba(15,23,42,0.06)',
    },
    formCard: {
      padding: '18px',
      display: 'grid',
      gap: '12px',
      minHeight: 0,
    },
    labelBlock: {
      fontSize: '0.68rem',
      fontWeight: 800,
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      color: '#0f5132',
      marginBottom: '6px',
    },
    sectionTitle: {
      margin: 0,
      fontSize: '1.25rem',
      letterSpacing: '-0.04em',
    },
    sectionText: {
      margin: '8px 0 0',
      color: '#475569',
      lineHeight: 1.5,
      fontSize: '0.92rem',
    },
    formGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '12px',
    },
    formGroup: {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    },
    fullWidth: {
      gridColumn: '1 / -1',
    },
    label: {
      fontSize: '0.82rem',
      fontWeight: 700,
      color: '#334155',
    },
    input: {
      width: '100%',
      borderRadius: '14px',
      border: '1px solid rgba(148,163,184,0.2)',
      padding: '12px 14px',
      fontSize: '0.95rem',
      outline: 'none',
      background: '#fff',
      color: '#0f172a',
      boxSizing: 'border-box',
    },
    inputDisabled: {
      width: '100%',
      borderRadius: '14px',
      border: '1px solid rgba(148,163,184,0.12)',
      padding: '12px 14px',
      fontSize: '0.95rem',
      background: '#f8fafc',
      color: '#64748b',
      boxSizing: 'border-box',
    },
    rightCard: {
      padding: '18px',
      display: 'grid',
      gap: '12px',
      minHeight: 0,
      overflow: 'hidden',
    },
    quickStats: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '10px',
    },
    statBox: {
      background: '#f8fafc',
      borderRadius: '16px',
      padding: '12px',
      border: '1px solid rgba(148,163,184,0.12)',
    },
    statLabel: {
      fontSize: '0.7rem',
      color: '#64748b',
      textTransform: 'uppercase',
      letterSpacing: '0.16em',
      marginBottom: '6px',
    },
    statValue: {
      fontSize: '0.96rem',
      fontWeight: 800,
      color: '#0f172a',
    },
    toggleList: {
      display: 'grid',
      gap: '10px',
    },
    toggleRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '10px 0',
      borderTop: '1px solid rgba(148,163,184,0.12)',
    },
    toggleLabel: {
      fontWeight: 700,
      color: '#0f172a',
      fontSize: '0.92rem',
    },
    toggleSub: {
      fontSize: '0.82rem',
      color: '#64748b',
      marginTop: '2px',
    },
    switch: {
      width: '48px',
      height: '28px',
      borderRadius: '999px',
      background: '#e2e8f0',
      position: 'relative',
      cursor: 'pointer',
      border: 'none',
      padding: 0,
      flexShrink: 0,
    },
    switchOn: {
      background: 'linear-gradient(135deg, #0f5132 0%, #0b6b45 100%)',
    },
    knob: {
      width: '22px',
      height: '22px',
      borderRadius: '999px',
      background: '#fff',
      position: 'absolute',
      top: '3px',
      left: '3px',
      transition: 'transform 0.2s ease',
      boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
    },
    knobOn: {
      transform: 'translateX(20px)',
    },
    buttonRow: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: '12px',
      flexWrap: 'wrap',
    },
    secondaryButton: {
      borderRadius: '14px',
      border: '1px solid rgba(148,163,184,0.22)',
      background: '#fff',
      color: '#0f172a',
      padding: '12px 16px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    primaryButton: {
      borderRadius: '14px',
      border: 'none',
      background: 'linear-gradient(135deg, #0f5132 0%, #0b6b45 100%)',
      color: '#fff',
      padding: '12px 16px',
      fontWeight: 800,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 12px 28px rgba(15,81,50,0.22)',
    },
    message: {
      padding: '12px 14px',
      borderRadius: '14px',
      fontSize: '0.94rem',
      lineHeight: 1.5,
      background: '#ecfdf5',
      color: '#065f46',
      border: '1px solid #bbf7d0',
    },
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', background: '#f4f8f2', color: '#0f5132', fontWeight: 700 }}>
        Loading profile...
      </div>
    );
  }

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
              <button type="button" className="profileIcon" style={styles.accountBtn} onClick={() => setShowDropdown((prev) => !prev)} aria-label="Account">
                <ShieldCheck size={18} />
              </button>
              {showDropdown && (
                <div style={styles.dropdown}>
                  <button type="button" onClick={() => { setShowDropdown(false); navigate('/profile'); }} style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 14px', textAlign: 'left', cursor: 'pointer' }}>Account</button>
                  <button type="button" onClick={handleLogout} style={{ width: '100%', border: 'none', background: 'transparent', padding: '12px 14px', textAlign: 'left', cursor: 'pointer' }}>Logout</button>
                </div>
              )}
            </div>
          </nav>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.hero}>
          <img src="/account_bg.png" alt="FasalGuard farm dashboard" style={styles.heroImage} />
          <div style={styles.heroOverlay} />
          <div style={styles.heroText}>
            <div style={styles.kicker}>Account Overview</div>
            <h1 style={styles.title}>{name || 'FasalGuard Farmer'}</h1>
            <p style={styles.subtitle}>A compact farm-focused account page for managing your profile, password, and alerts without adding extra clutter.</p>
          </div>
        </section>

        <section style={styles.grid}>
          <div style={{ ...styles.card, ...styles.formCard }}>
            <div>
              <div style={styles.labelBlock}>Profile Details</div>
              <h2 style={styles.sectionTitle}>Update identity</h2>
              <p style={styles.sectionText}>Keep your account current. Backend validation remains unchanged.</p>
            </div>

            <div style={styles.formGrid}>
              <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                <label style={styles.label}><User size={14} /> Full Name</label>
                <input type="text" value={name} style={styles.input} onChange={(event) => setName(event.target.value)} />
              </div>
              <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                <label style={styles.label}><Lock size={14} /> Email Address</label>
                <input type="email" value={user?.email || ''} style={styles.inputDisabled} disabled />
              </div>

              {user && user?.provider !== 'google' && (
                <>
                  <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                    <label style={styles.label}><Lock size={14} /> Current Password</label>
                    <input type="password" value={currentPassword} style={styles.input} onChange={(event) => setCurrentPassword(event.target.value)} />
                  </div>
                  <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                    <label style={styles.label}><Lock size={14} /> New Password</label>
                    <input type="password" value={newPassword} style={styles.input} onChange={(event) => setNewPassword(event.target.value)} />
                  </div>
                  <div style={{ ...styles.formGroup, ...styles.fullWidth }}>
                    <label style={styles.label}><Lock size={14} /> Confirm New Password</label>
                    <input type="password" value={confirmPassword} style={styles.input} onChange={(event) => setConfirmPassword(event.target.value)} />
                  </div>
                </>
              )}
            </div>
          </div>

          <div style={{ ...styles.card, ...styles.rightCard }}>
            <div>
              <div style={styles.labelBlock}>Farm Focus</div>
              <h2 style={styles.sectionTitle}>Quick status</h2>
              <p style={styles.sectionText}>A simple view of the account state and alert preferences.</p>
            </div>

            <div style={styles.quickStats}>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Account</div>
                <div style={styles.statValue}>{user?.provider || 'Local'}</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Status</div>
                <div style={styles.statValue}>Active</div>
              </div>
              <div style={styles.statBox}>
                <div style={styles.statLabel}>Focus</div>
                <div style={styles.statValue}>Agri-first</div>
              </div>
            </div>

            <div style={styles.toggleList}>
              <div style={styles.toggleRow}>
                <div>
                  <div style={styles.toggleLabel}>Satellite Updates</div>
                  <div style={styles.toggleSub}>Real-time alerts for new imagery.</div>
                </div>
                <button type="button" style={{ ...styles.switch, ...(alerts.satellite ? styles.switchOn : {}) }} onClick={() => setAlerts((prev) => ({ ...prev, satellite: !prev.satellite }))}>
                  <span style={{ ...styles.knob, ...(alerts.satellite ? styles.knobOn : {}) }} />
                </button>
              </div>
              <div style={styles.toggleRow}>
                <div>
                  <div style={styles.toggleLabel}>Anomaly Detection</div>
                  <div style={styles.toggleSub}>Alerts for crop stress or pests.</div>
                </div>
                <button type="button" style={{ ...styles.switch, ...(alerts.anomaly ? styles.switchOn : {}) }} onClick={() => setAlerts((prev) => ({ ...prev, anomaly: !prev.anomaly }))}>
                  <span style={{ ...styles.knob, ...(alerts.anomaly ? styles.knobOn : {}) }} />
                </button>
              </div>
              <div style={styles.toggleRow}>
                <div>
                  <div style={styles.toggleLabel}>Weather Reports</div>
                  <div style={styles.toggleSub}>Daily localized weather summary.</div>
                </div>
                <button type="button" style={{ ...styles.switch, ...(alerts.weather ? styles.switchOn : {}) }} onClick={() => setAlerts((prev) => ({ ...prev, weather: !prev.weather }))}>
                  <span style={{ ...styles.knob, ...(alerts.weather ? styles.knobOn : {}) }} />
                </button>
              </div>
            </div>

            <div style={styles.buttonRow}>
              <button type="button" style={styles.secondaryButton} onClick={() => navigate('/contact')}>Contact Support</button>
              <button type="button" style={styles.secondaryButton} onClick={() => navigate('/satellite-analysis')}>Open Satellite</button>
              <button type="button" style={styles.primaryButton} onClick={handleSave}>
                <Save size={18} /> Save Profile
              </button>
            </div>

            {saveMsg && <div style={styles.message}>{saveMsg}</div>}
          </div>
        </section>
      </main>
    </div>
  );
}
