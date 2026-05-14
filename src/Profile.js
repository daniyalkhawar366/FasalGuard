import React, { useState } from 'react';
import { Leaf, User, Lock, Camera, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const styles = {
  page: {
    minHeight: '100vh',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    color: '#222',
    padding: 0,
    margin: 0,
    background: '#0a0e0d',
    position: 'relative',
    overflowX: 'hidden',
  },
  bgPattern: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `radial-gradient(circle at 20% 50%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
                      radial-gradient(circle at 80% 80%, rgba(5, 150, 105, 0.15) 0%, transparent 50%),
                      radial-gradient(circle at 40% 20%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)`,
    zIndex: 0,
  },
  header: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    padding: '2rem 3rem',
    zIndex: 100,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'rgba(10, 14, 13, 0.95)',
    backdropFilter: 'blur(20px)',
    // Removed borderBottom for no boundary
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  logoIcon: {
    border: '2px solid #10b981',
    borderRadius: '50%',
    padding: '0.3rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: '1rem',
    fontWeight: 400,
    color: '#059669',
    letterSpacing: '3px',
    textTransform: 'uppercase',
  },
  nav: {
    display: 'flex',
    gap: '3rem',
    alignItems: 'center',
  },
  navLink: {
    color: '#9ca3af',
    fontSize: '0.9rem',
    fontWeight: 400,
    textDecoration: 'none',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'color 0.3s',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: 0,
  },
  container: {
    position: 'relative',
    zIndex: 1,
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '6rem 2rem 4rem 2rem',
  },
  pageHeader: {
    marginBottom: '3rem',
  },
  pageTitle: {
    fontSize: '3rem',
    fontWeight: 600,
    background: 'linear-gradient(135deg, #fff 0%, #a3a3a3 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    marginBottom: '0.5rem',
    letterSpacing: '1px',
  },
  pageSubtitle: {
    fontSize: '1.1rem',
    color: '#6b7280',
    fontWeight: 300,
  },
  contentGrid: {
    display: 'grid',
    gridTemplateColumns: '320px 1fr',
    gap: '2rem',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  profileCard: {
    background: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '1.5rem',
    padding: '2rem',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  profileCardGlow: {
    position: 'absolute',
    top: '-50%',
    left: '-50%',
    right: '-50%',
    bottom: '-50%',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 70%)',
    animation: 'pulse 4s ease-in-out infinite',
  },
  avatarWrapper: {
    position: 'relative',
    width: '120px',
    height: '120px',
    margin: '0 auto 1.5rem',
  },
  avatar: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '2.5rem',
    fontWeight: 600,
    border: '3px solid rgba(16, 185, 129, 0.3)',
    boxShadow: '0 0 30px rgba(16, 185, 129, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.1)',
    position: 'relative',
    zIndex: 2,
  },
  cameraButton: {
    position: 'absolute',
    bottom: '5px',
    right: '5px',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    border: 'none',
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.4)',
    transition: 'all 0.3s',
    zIndex: 3,
  },
  userName: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '0.25rem',
    position: 'relative',
    zIndex: 2,
  },
  userEmail: {
    fontSize: '0.95rem',
    color: '#9ca3af',
    fontWeight: 300,
    position: 'relative',
    zIndex: 2,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '1rem',
    marginTop: '1.5rem',
    position: 'relative',
    zIndex: 2,
  },
  statBox: {
    padding: '1rem',
    background: 'rgba(16, 185, 129, 0.1)',
    borderRadius: '0.75rem',
    border: '1px solid rgba(16, 185, 129, 0.2)',
  },
  statValue: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#10b981',
    marginBottom: '0.25rem',
  },
  statLabel: {
    fontSize: '0.75rem',
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  menuCard: {
    background: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '1.5rem',
    padding: '1rem',
  },
  menuItem: {
    padding: '1rem',
    marginBottom: '0.5rem',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    color: '#9ca3af',
    transition: 'all 0.3s',
    fontSize: '0.95rem',
  },
  menuItemActive: {
    padding: '1rem',
    marginBottom: '0.5rem',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%)',
    border: '1px solid rgba(16, 185, 129, 0.3)',
    color: '#10b981',
    transition: 'all 0.3s',
    fontSize: '0.95rem',
    fontWeight: 500,
  },
  mainContent: {
    background: 'rgba(17, 24, 39, 0.6)',
    backdropFilter: 'blur(20px)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '1.5rem',
    padding: '3rem',
    position: 'relative',
    overflow: 'hidden',
  },
  contentGlow: {
    position: 'absolute',
    top: '-50%',
    right: '-20%',
    width: '400px',
    height: '400px',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  sectionTitle: {
    fontSize: '2rem',
    fontWeight: 600,
    color: '#fff',
    marginBottom: '0.5rem',
    position: 'relative',
    zIndex: 2,
  },
  sectionSubtitle: {
    fontSize: '1rem',
    color: '#9ca3af',
    fontWeight: 300,
    marginBottom: '3rem',
    position: 'relative',
    zIndex: 2,
  },
  formGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '2rem',
    position: 'relative',
    zIndex: 2,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  formGroupFull: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    gridColumn: '1 / -1',
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: 500,
    color: '#d1d5db',
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    width: '100%',
    padding: '1rem 1.25rem',
    fontSize: '1rem',
    fontWeight: 300,
    color: '#fff',
    background: 'rgba(31, 41, 55, 0.5)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '0.75rem',
    outline: 'none',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    transition: 'all 0.3s',
  },
  inputDisabled: {
    width: '100%',
    padding: '1rem 1.25rem',
    fontSize: '1rem',
    fontWeight: 300,
    color: '#6b7280',
    background: 'rgba(31, 41, 55, 0.3)',
    border: '1px solid rgba(75, 85, 99, 0.3)',
    borderRadius: '0.75rem',
    outline: 'none',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    cursor: 'not-allowed',
  },
  inputIcon: {
    position: 'absolute',
    right: '1rem',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#6b7280',
    cursor: 'pointer',
  },
  divider: {
    height: '1px',
    background: 'linear-gradient(90deg, transparent 0%, rgba(16, 185, 129, 0.3) 50%, transparent 100%)',
    margin: '3rem 0',
    position: 'relative',
    zIndex: 2,
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'flex-end',
    marginTop: '3rem',
    position: 'relative',
    zIndex: 2,
  },
  btnSecondary: {
    padding: '1rem 2rem',
    fontSize: '0.95rem',
    fontWeight: 500,
    color: '#d1d5db',
    background: 'rgba(31, 41, 55, 0.5)',
    border: '1px solid rgba(16, 185, 129, 0.2)',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    transition: 'all 0.3s',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  btnPrimary: {
    padding: '1rem 2.5rem',
    fontSize: '0.95rem',
    fontWeight: 500,
    color: '#fff',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    border: 'none',
    borderRadius: '0.75rem',
    cursor: 'pointer',
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.3)',
    transition: 'all 0.3s',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  alert: {
    padding: '1.25rem',
    background: 'rgba(245, 158, 11, 0.1)',
    border: '1px solid rgba(245, 158, 11, 0.3)',
    borderRadius: '0.75rem',
    marginBottom: '2rem',
    display: 'flex',
    gap: '1rem',
    alignItems: 'start',
    position: 'relative',
    zIndex: 2,
  },
  alertIcon: {
    color: '#f59e0b',
    flexShrink: 0,
  },
  alertText: {
    fontSize: '0.9rem',
    color: '#fbbf24',
    lineHeight: '1.6',
  },
};

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  React.useEffect(() => {
    if (user) {
      console.log('Profile user object:', user);
    }
  }, [user]);
  const [name, setName] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  React.useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
      .then(res => res.json())
      .then(data => {
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

  const handleSave = async () => {
    setSaveMsg('');
    const token = localStorage.getItem('token');
    if (!token) {
      navigate('/login');
      return;
    }
    let nameUpdateSuccess = false;
    let passwordUpdateSuccess = false;
    // If password fields are filled, update both name and password in one request
    if (user?.provider !== 'google' && (currentPassword || newPassword || confirmPassword)) {
      if (!currentPassword || !newPassword || !confirmPassword) {
        setSaveMsg('Please fill all password fields.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setSaveMsg('New passwords do not match.');
        return;
      }
      // Strong password validation (same as signup)
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(newPassword)) {
        setSaveMsg('Password must be at least 8 characters and include uppercase, lowercase, number, and special character.');
        return;
      }
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/auth/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name, currentPassword, newPassword })
        });
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
          nameUpdateSuccess = true;
          passwordUpdateSuccess = true;
          setCurrentPassword('');
          setNewPassword('');
          setConfirmPassword('');
        } else {
          setSaveMsg(data.message || 'Failed to update profile or password.');
          return;
        }
      } catch (err) {
        setSaveMsg('Error updating profile or password.');
        return;
      }
    } else {
      // Only name update
      try {
        const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/auth/profile`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (data.success) {
          setUser(data.user);
          nameUpdateSuccess = true;
        } else {
          setSaveMsg(data.message || 'Failed to update name.');
          return;
        }
      } catch (err) {
        setSaveMsg('Error updating name.');
        return;
      }
    }
    if (nameUpdateSuccess && passwordUpdateSuccess) {
      setSaveMsg('Profile and password updated!');
    } else if (nameUpdateSuccess) {
      setSaveMsg('Profile updated!');
    } else if (passwordUpdateSuccess) {
      setSaveMsg('Password updated!');
    }
  };

  // Profile dropdown logic
  const [showDropdown, setShowDropdown] = useState(false);
  React.useEffect(() => {
    if (!showDropdown) return;
    const handleClick = (e) => {
      const profileIcon = document.querySelector('.profileIcon');
      const dropdown = document.querySelector('[tabindex="-1"]');
      if (profileIcon && dropdown && !profileIcon.contains(e.target) && !dropdown.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showDropdown]);

  // Restrict Account/profile button to logged-in users
  const handleAccountClick = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.replace('/login');
    } else {
      navigate('/profile');
    }
  };

  return (
    <div style={{ ...styles.page, opacity: loading ? 0 : 1, transition: 'opacity 0.6s cubic-bezier(.4,0,.2,1)' }}>
      <style>{`
        ::-webkit-scrollbar { width: 0px; background: transparent; }
        * { scrollbar-width: none; -ms-overflow-style: none; }
      `}</style>
      <header style={styles.header}>
        <div style={{ ...styles.logo, cursor: 'pointer' }} onClick={() => navigate('/home')} role="button" tabIndex={0} aria-label="Go to homepage">
          <span style={styles.logoIcon}>
            <Leaf size={20} color="#10b981" />
          </span>
          <span style={styles.logoText}>FASALGUARD</span>
        </div>
        <nav style={styles.nav}>
          <button style={styles.navLink} type="button" onClick={() => navigate('/about')}>About Us</button>
          <a
            style={styles.navLink}
            onClick={e => {
              e.preventDefault();
              document.body.style.scrollBehavior = 'auto';
              navigate('/contact');
              setTimeout(() => {
                document.body.style.scrollBehavior = 'smooth';
              }, 500);
            }}
            href="/contact"
          >Contact Us</a>
          <div style={{ position: 'relative', marginLeft: '1.5rem' }}>
            <span
              style={{ color: '#fff', fontSize: '1.5rem', cursor: 'pointer', transition: 'color 0.3s' }}
              onClick={() => setShowDropdown((prev) => !prev)}
              title="Profile"
              className="profileIcon"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/><path stroke="currentColor" strokeWidth="2" d="M4 20c0-2.21 3.58-4 8-4s8 1.79 8 4"/></svg>
            </span>
            {showDropdown && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  background: '#222',
                  color: '#fff',
                  borderRadius: '10px',
                  boxShadow: '0 4px 24px rgba(16,185,129,0.18)',
                  minWidth: '140px',
                  zIndex: 999,
                  padding: '0.5rem 0',
                  fontSize: '1rem',
                  border: '1px solid #059669',
                  animation: 'fadeIn 0.2s',
                }}
                tabIndex={-1}
              >
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.75rem 1.5rem',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => { setShowDropdown(false); handleAccountClick(); }}
                  onMouseDown={e => e.preventDefault()}
                >Account</button>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    width: '100%',
                    textAlign: 'left',
                    padding: '0.75rem 1.5rem',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => {
                    setShowDropdown(false);
                    localStorage.removeItem('token');
                    window.location.replace('/login');
                  }}
                  onMouseDown={e => e.preventDefault()}
                >Logout</button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <div style={styles.container}>
        <div style={styles.pageHeader}>
          <h1 style={styles.pageTitle}>Profile & Settings</h1>
          <p style={styles.pageSubtitle}>Manage your account information and password</p>
        </div>
        <div style={styles.contentGrid}>
          <div style={styles.sidebar}>
            <div style={styles.profileCard}>
              <div style={styles.profileCardGlow}></div>
              <div style={styles.avatarWrapper}>
                <div style={styles.avatar}>{name ? name.split(' ').map(n => n[0]).join('').toUpperCase() : ''}</div>
                <button style={styles.cameraButton} className="cameraButton">
                  <Camera size={20} color="#fff" />
                </button>
              </div>
              <div style={styles.userName}>{name}</div>
              <div style={styles.userEmail}>{user?.email || ''}</div>
            </div>
          </div>
          <div style={styles.mainContent}>
            <div style={styles.contentGlow}></div>
            <div style={styles.formGrid}>
              <div style={styles.formGroupFull}>
                <label style={styles.label}><User size={14} /> Name</label>
                <input type="text" value={name} style={styles.input} onChange={e => setName(e.target.value)} />
              </div>
              <div style={styles.formGroupFull}>
                <label style={styles.label}><Lock size={14} /> Email</label>
                <input type="email" value={user?.email || ''} style={styles.inputDisabled} disabled />
              </div>
              {/* Only show password fields for users without googleId and provider google */}
              {user && !user.googleId && user?.provider !== 'google' && user?.provider !== 'Google' && (
                <>
                  <div style={styles.formGroupFull}>
                    <label style={styles.label}><Lock size={14} /> Current Password</label>
                    <input type="password" value={currentPassword} style={styles.input} onChange={e => setCurrentPassword(e.target.value)} />
                  </div>
                  <div style={styles.formGroupFull}>
                    <label style={styles.label}><Lock size={14} /> New Password</label>
                    <div style={styles.inputWrapper}>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={newPassword}
                        style={styles.input}
                        onChange={e => setNewPassword(e.target.value)}
                      />
                      <span
                        style={styles.inputIcon}
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        title={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="#059669" strokeWidth="2" d="M3 3l18 18M10.7 6.7A7.97 7.97 0 0 1 12 6c5 0 9 4 9 6s-2.1 4.6-5.2 5.7M6.7 10.7C5.6 11.4 4 13 4 14c0 2 4 6 8 6s8-4 8-6c0-1.1-1.6-2.6-2.7-3.3"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="#059669" strokeWidth="2" d="M1 12s4-6 11-6 11 6 11 6-4 6-11 6S1 12 1 12zm11-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                        )}
                      </span>
                    </div>
                  </div>
                  <div style={styles.formGroupFull}>
                    <label style={styles.label}><Lock size={14} /> Confirm New Password</label>
                    <div style={styles.inputWrapper}>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        style={styles.input}
                        onChange={e => setConfirmPassword(e.target.value)}
                      />
                      <span
                        style={styles.inputIcon}
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="#059669" strokeWidth="2" d="M3 3l18 18M10.7 6.7A7.97 7.97 0 0 1 12 6c5 0 9 4 9 6s-2.1 4.6-5.2 5.7M6.7 10.7C5.6 11.4 4 13 4 14c0 2 4 6 8 6s8-4 8-6c0-1.1-1.6-2.6-2.7-3.3"/></svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="#059669" strokeWidth="2" d="M1 12s4-6 11-6 11 6 11 6-4 6-11 6S1 12 1 12zm11-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>
                        )}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div style={styles.buttonGroup}>
              <button style={styles.btnPrimary} className="btnPrimary" onClick={handleSave}>
                <Save size={18} /> Save
              </button>
            </div>
            {saveMsg && <div style={{ color: '#10b981', marginTop: '1rem', fontWeight: 500 }}>{saveMsg}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}