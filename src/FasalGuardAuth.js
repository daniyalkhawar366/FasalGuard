import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, Moon, Sun, ArrowRight, User, Mail, Lock, Eye, EyeOff, Info } from 'lucide-react';
import { GoogleLogin, useGoogleLogin } from '@react-oauth/google';

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app';

const passwordRequirements = [
  { label: 'At least 8 characters', test: (v) => v.length >= 8 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One lowercase letter', test: (v) => /[a-z]/.test(v) },
  { label: 'One number', test: (v) => /\d/.test(v) },
  { label: 'One special character', test: (v) => /[^A-Za-z\d]/.test(v) },
];

const FasalGuardAuth = ({ onLogin, initialView = 'login' }) => {
  const [showPasswordInfo, setShowPasswordInfo] = useState(false);
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState(initialView || 'login');
  const [flow, setFlow] = useState('verify'); // 'verify' or 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [verifiedOtp, setVerifiedOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const isDarkMode = false;

  const handleTransition = (view) => {
    clearMessages();
    setCurrentView(view);
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // keep URL in sync when initialView changes
  useEffect(() => {
    if (currentView === 'login') navigate('/login', { replace: true });
    if (currentView === 'signup') navigate('/signup', { replace: true });
    if (currentView === 'otp') navigate('/verify', { replace: true });
    if (currentView === 'forgot-password') navigate('/forgot-password', { replace: true });
    if (currentView === 'reset-password') navigate('/reset-password', { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  const handleOtpChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);
      
      if (value && index < 5) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        if (nextInput) nextInput.focus();
      }
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      console.log('Login response:', data); // Debug log

      if (data.success && data.user && data.token) {
        setSuccess('Login successful!');
        // Small delay to show success message, then redirect
        setTimeout(() => {
          onLogin(data.user, data.token);
        }, 500);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCredential = async (credentialResponse) => {
    try {
      const idToken = credentialResponse?.credential;
      const accessToken = credentialResponse?.access_token || credentialResponse?.accessToken;
      if (!idToken && !accessToken) {
        setError('Google sign-in failed to return a token');
        return;
      }

      setLoading(true);
      const body = idToken ? { idToken } : { accessToken };
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      // Read raw text first to avoid JSON parse errors on empty responses
      const raw = await res.text();
      let data = null;
      if (raw && raw.length > 0) {
        try {
          data = JSON.parse(raw);
        } catch (e) {
          console.error('Google auth: failed to parse JSON response', raw, e);
          setError('Server returned an invalid response');
          return;
        }
      } else {
        console.error('Google auth: empty response body', { status: res.status, statusText: res.statusText });
        setError('Empty response from authentication server');
        return;
      }
      if (data.success && data.token && data.user) {
        onLogin(data.user, data.token);
      } else {
        setError(data.message || 'Google sign-in failed');
      }
      } catch (err) {
      console.error('Google sign-in error:', err);
      setError('Google sign-in error');
    } finally {
      setLoading(false);
    }
  };

  // hooks for custom buttons so we can control text
  const loginWithGoogleSignIn = useGoogleLogin({
    onSuccess: handleGoogleCredential,
    onError: () => setError('Google sign-in failed')
  });

  const loginWithGoogleSignUp = useGoogleLogin({
    onSuccess: handleGoogleCredential,
    onError: () => setError('Google sign-in failed')
  });

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();
      console.log('Register response:', data); // Debug log

      if (data.success && data.pending) {
        setFlow('verify');
        setSuccess('OTP sent to your email. Please verify to continue.');
        setTimeout(() => {
          handleTransition('otp');
        }, 400);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const endpoint = flow === 'verify' ? '/api/auth/verify-email' : '/api/auth/verify-reset';
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await response.json();
      if (data.success) {
        if (flow === 'verify') {
          // After verification, auto-login
          try {
            const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password })
            });
            const loginData = await loginRes.json();
            if (loginData.success && loginData.token && loginData.user) {
              onLogin(loginData.user, loginData.token);
              return;
            }
          } catch(e) {}
          setSuccess('Email verified! Please log in.');
          setTimeout(() => handleTransition('login'), 700);
        } else {
          setSuccess('Code verified! Set your new password.');
          setVerifiedOtp(code);
          handleTransition('reset-password');
        }
      } else {
        setError(data.message || 'Verification failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const endpoint = flow === 'verify' ? '/api/auth/resend-verification' : '/api/auth/resend-reset';
      const response = await fetch(`${API_BASE}/api/auth${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(flow === 'verify' ? 'Verification code resent. Check your email.' : 'Reset code resent. Check your email.');
      } else {
        setError(data.message || 'Failed to resend code');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword1 !== newPassword2) {
      setError('Passwords do not match');
      return;
    }
    if (newPassword1.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      // Use the verified OTP from previous step
      const code = verifiedOtp;
      const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, newPassword: newPassword1 })
      });
      const data = await response.json();
      if (data.success) {
        setSuccess('Password reset successful! Please log in.');
        setTimeout(() => {
          handleTransition('login');
        }, 1000);
      } else {
        setError(data.message || 'Reset failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = (e) => {
    e?.preventDefault(); // Prevent page refresh if event exists
    if (!email) {
      setError('Please enter your email to reset your password.');
      return;
    }
    handleTransition('forgot-password');
  };

  const handleSendResetOTP = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      
      if (data.success) {
        setFlow('reset');
        setSuccess('OTP has been sent to your email.');
        setCurrentView('otp');
        navigate('/verify', { replace: true });
      } else {
        setError('No account found with this email address.');
        return;
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    mainContainer: {
      minHeight: '100vh',
      display: 'flex',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      position: 'relative',
      backgroundColor: '#ffffff',
    },
    leftSection: {
      flex: 1,
      position: 'relative',
      backgroundImage: 'url(/auth_bg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'flex-start',
      padding: '4rem',
      transform: 'translateX(0)',
    },
    leftOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(4, 47, 26, 0.55)',
    },
    leftContent: {
      position: 'relative',
      zIndex: 1,
      color: '#ffffff',
      maxWidth: '480px',
    },
    leftLogoText: {
      fontSize: 'clamp(2rem, 5vw, 3.5rem)',
      fontWeight: '800',
      color: '#ffffff',
      marginBottom: '1rem',
      letterSpacing: '0.05em',
      textShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
    },
    leftTagline: {
      fontSize: '1.25rem',
      lineHeight: '1.6',
      color: '#e2e8f0',
      textShadow: '0 2px 10px rgba(0, 0, 0, 0.4)',
    },
    rightSection: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem',
      backgroundColor: '#ffffff',
      position: 'relative',
      transform: 'translateX(0)',
    },
    formCard: {
      width: '100%',
      maxWidth: '480px',
      padding: '2.5rem',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      marginBottom: '2rem',
    },
    logoIcon: {
      width: '60px',
      height: '60px',
      borderRadius: '12px',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.5)',
      flexShrink: 0,
    },
    headerText: {
      flex: 1,
      textAlign: 'left',
    },
    title: {
      fontSize: 'clamp(1.5rem, 4vw, 1.875rem)',
      fontWeight: 'bold',
      color: '#1f2937',
      margin: 0,
      marginBottom: '0.25rem',
      textAlign: 'left',
    },
    subtitle: {
      color: '#6b7280',
      margin: 0,
      fontSize: '0.875rem',
      textAlign: 'left',
    },
    formGroup: {
      marginBottom: '1.5rem',
      position: 'relative',
    },
    label: {
      display: 'block',
      fontSize: '0.875rem',
      fontWeight: '500',
      color: '#374151',
      marginBottom: '0.5rem',
      textAlign: 'left',
    },
    inputWrapper: {
      position: 'relative',
    },
    inputIcon: {
      position: 'absolute',
      left: '1rem',
      top: '50%',
      transform: 'translateY(-50%)',
      color: '#10b981',
      pointerEvents: 'none',
    },
    input: {
      width: '100%',
      padding: '0.875rem 1rem 0.875rem 3rem',
      fontSize: '1rem',
      borderRadius: '8px',
      border: '2px solid #e5e7eb',
      backgroundColor: '#ffffff',
      color: '#1f2937',
      outline: 'none',
      transition: 'all 0.3s ease',
      boxSizing: 'border-box',
    },
    eyeIcon: {
      position: 'absolute',
      right: '1rem',
      top: '50%',
      transform: 'translateY(-50%)',
      cursor: 'pointer',
      color: '#9ca3af',
    },
    button: {
      width: '100%',
      padding: '1rem',
      fontSize: '1rem',
      fontWeight: '600',
      color: '#ffffff',
      background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)',
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      marginBottom: '1.5rem',
      boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.4)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
    },
    linkButton: {
      background: 'none',
      border: 'none',
      color: '#10b981',
      fontWeight: '600',
      cursor: 'pointer',
      textDecoration: 'none',
      fontSize: 'inherit',
      padding: 0,
      transition: 'color 0.3s ease',
    },
    footer: {
      textAlign: 'center',
      fontSize: '0.875rem',
      color: '#6b7280',
      marginTop: '1.5rem',
    },
    backButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      color: '#6b7280',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '0.875rem',
      marginBottom: '1.5rem',
      padding: 0,
      transition: 'color 0.3s ease',
    },
    otpContainer: {
      display: 'flex',
      gap: '1rem',
      justifyContent: 'center',
      marginBottom: '2rem',
    },
    otpInput: {
      width: '50px',
      height: '50px',
      fontSize: '1.5rem',
      fontWeight: 'bold',
      textAlign: 'center',
      borderRadius: '8px',
      border: '2px solid #e5e7eb',
      backgroundColor: '#ffffff',
      color: '#1f2937',
      outline: 'none',
      transition: 'all 0.3s ease',
    },
    resendText: {
      textAlign: 'center',
      fontSize: '0.875rem',
      color: '#6b7280',
      marginBottom: '1rem',
    },
  };

  // Main render
  return (
    <div style={styles.mainContainer} className="resp-auth-main">
      <div style={styles.leftSection} className="resp-auth-left">
        <div style={styles.leftOverlay} />
        <div style={styles.leftContent}>
          <div style={styles.leftLogoText}>FasalGuard</div>
          <p style={styles.leftTagline}>Empowering modern farmers with satellite-driven insights, precise weather forecasts, and smart yield prediction to grow more with less.</p>
        </div>
      </div>
      <div style={styles.rightSection}>
        <div style={styles.formCard} className="resp-auth-card">
          {currentView === 'login' && (
            <React.Fragment>
              <div style={styles.header}>
                <div style={styles.logoIcon}>
                  <Leaf color="white" size={32} />
                </div>
                <div style={styles.headerText}>
                  <h1 style={styles.title}>Welcome to Your Smart Farm</h1>
                  <p style={styles.subtitle}>Access your field insights and satellite data</p>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#10b981',
                      cursor: 'pointer',
                      padding: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontWeight: 500,
                    }}
                  >
                    <Lock size={16} />
                    Forgot Password?
                  </button>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <div style={styles.inputWrapper}>
                    <div style={styles.inputIcon}>
                      <Mail size={20} />
                    </div>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Password
                    <span style={{ marginLeft: 6, cursor: 'pointer', position: 'relative' }}
                      onMouseEnter={() => setShowPasswordInfo(true)}
                      onMouseLeave={() => setShowPasswordInfo(false)}>
                      <Info size={16} color="#10b981" />
                      {showPasswordInfo && (
                        <div style={{
                          position: 'absolute',
                          left: 20,
                          top: 0,
                          background: '#fff',
                          color: '#222',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          padding: '0.75rem',
                          fontSize: '0.95rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          zIndex: 10,
                          minWidth: 220
                        }}>
                          <b>Password requirements:</b>
                          <ul style={{ margin: '0.5rem 0 0 0', padding: 0, listStyle: 'none' }}>
                            {passwordRequirements.map((req, i) => (
                              <li key={i} style={{ color: req.test(password) ? '#10b981' : '#dc2626', fontWeight: req.test(password) ? 600 : 400 }}>
                                {req.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </span>
                  </label>
                  <div style={styles.inputWrapper}>
                    <div style={styles.inputIcon}>
                      <Lock size={20} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={styles.input}
                    />
                    <div 
                      style={styles.eyeIcon}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </div>
                  </div>
                </div>
                <form onSubmit={handleLogin}>
                  {error && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                      border: '1px solid #fecaca'
                    }}>
                      {error}
                    </div>
                  )}
                  {success && (
                    <div style={{
                      backgroundColor: '#f0fdf4',
                      color: '#16a34a',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                      border: '1px solid #bbf7d0'
                    }}>
                      {success}
                    </div>
                  )}
                  <button 
                    type="submit"
                    style={{
                      ...styles.button,
                      opacity: loading ? 0.7 : 1,
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Signing in...' : 'Continue'} <ArrowRight size={20} />
                  </button>
                </form>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0' }}>
                  <div style={{ width: '85%', height: '1px', background: '#e5e7eb', alignSelf: 'center' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                  <button
                    onClick={() => loginWithGoogleSignIn()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      background: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <img src="google.png" alt="Google" style={{ width: 18, height: 18 }} />
                    <span style={{ color: '#111827', fontWeight: 600 }}>Sign in with Google</span>
                  </button>
                </div>
                <div style={styles.footer}>
                  Don't have an account?{' '}
                  <button style={styles.linkButton} onClick={() => handleTransition('signup')}>
                    Sign up
                  </button>
                </div>
              </div>
            </React.Fragment>
          )}
          {currentView === 'signup' && (
            <React.Fragment>
              <div style={styles.header}>
                <div style={styles.logoIcon}>
                  <Leaf color="white" size={32} />
                </div>
                <div style={styles.headerText}>
                  <h1 style={styles.title}>Start Your Smart Farming Journey</h1>
                  <p style={styles.subtitle}>Join the modern agricultural community</p>
                </div>
              </div>
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Full Name</label>
                  <div style={styles.inputWrapper}>
                    <div style={styles.inputIcon}>
                      <User size={20} />
                    </div>
                    <input
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <div style={styles.inputWrapper}>
                    <div style={styles.inputIcon}>
                      <Mail size={20} />
                    </div>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Password
                    <span style={{ marginLeft: 6, cursor: 'pointer', position: 'relative' }}
                      onMouseEnter={() => setShowPasswordInfo(true)}
                      onMouseLeave={() => setShowPasswordInfo(false)}>
                      <Info size={16} color="#10b981" />
                      {showPasswordInfo && (
                        <div style={{
                          position: 'absolute',
                          left: 20,
                          top: 0,
                          background: '#fff',
                          color: '#222',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          padding: '0.75rem',
                          fontSize: '0.95rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          zIndex: 10,
                          minWidth: 220
                        }}>
                          <b>Password requirements:</b>
                          <ul style={{ margin: '0.5rem 0 0 0', padding: 0, listStyle: 'none' }}>
                            {passwordRequirements.map((req, i) => (
                              <li key={i} style={{ color: req.test(password) ? '#10b981' : '#dc2626', fontWeight: req.test(password) ? 600 : 400 }}>
                                {req.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </span>
                  </label>
                  <div style={styles.inputWrapper}>
                    <div style={styles.inputIcon}>
                      <Lock size={20} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={styles.input}
                    />
                    <div 
                      style={styles.eyeIcon}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </div>
                  </div>
                </div>
                <form onSubmit={handleRegister}>
                  {error && (
                    <div style={{
                      backgroundColor: '#fef2f2',
                      color: '#dc2626',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                      border: '1px solid #fecaca'
                    }}>
                      {error}
                    </div>
                  )}
                  {success && (
                    <div style={{
                      backgroundColor: '#f0fdf4',
                      color: '#16a34a',
                      padding: '0.75rem',
                      borderRadius: '6px',
                      marginBottom: '1rem',
                      fontSize: '0.875rem',
                      border: '1px solid #bbf7d0'
                    }}>
                      {success}
                    </div>
                  )}
                  <button 
                    type="submit"
                    style={{
                      ...styles.button,
                      opacity: loading ? 0.7 : 1,
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                    disabled={loading}
                  >
                    {loading ? 'Creating...' : 'Create Account'} <ArrowRight size={20} />
                  </button>
                </form>
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0.75rem 0' }}>
                  <div style={{ width: '85%', height: '1px', background: '#e5e7eb', alignSelf: 'center' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
                  <button
                    onClick={() => loginWithGoogleSignUp()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      background: '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <img src="google.png" alt="Google" style={{ width: 18, height: 18 }} />
                    <span style={{ color: '#111827', fontWeight: 600 }}>Sign up with Google</span>
                  </button>
                </div>
                <div style={styles.footer}>
                  Already have an account?{' '}
                  <button style={styles.linkButton} onClick={() => handleTransition('login')}>
                    Sign in
                  </button>
                </div>
              </div>
            </React.Fragment>
          )}
          {currentView === 'forgot-password' && (
            <React.Fragment>
              <div style={styles.header}>
                <div style={styles.logoIcon}>
                  <Lock color="white" size={32} />
                </div>
                <div style={styles.headerText}>
                  <h1 style={styles.title}>Reset Password</h1>
                  <p style={styles.subtitle}>Enter your email to receive a reset code</p>
                </div>
              </div>
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Email</label>
                  <div style={styles.inputWrapper}>
                    <div style={styles.inputIcon}>
                      <Mail size={20} />
                    </div>
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={styles.input}
                    />
                  </div>
                </div>
                {error && (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    border: '1px solid #fecaca'
                  }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{
                    backgroundColor: '#f0fdf4',
                    color: '#16a34a',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    border: '1px solid #bbf7d0'
                  }}>
                    {success}
                  </div>
                )}
                <button 
                  onClick={handleSendResetOTP}
                  style={{
                    ...styles.button,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Sending...' : 'Send Reset Code'} <ArrowRight size={20} />
                </button>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button 
                    style={styles.linkButton} 
                    onClick={() => handleTransition('login')}
                  >
                    Back to Login
                  </button>
                </div>
              </div>
            </React.Fragment>
          )}
          {currentView === 'otp' && (
            <React.Fragment>
              <div style={styles.header}>
                <div style={styles.logoIcon}>
                  <Leaf color="white" size={32} />
                </div>
                <div style={styles.headerText}>
                  <h1 style={styles.title}>{flow === 'reset' ? 'Verify Reset Code' : 'Verify Your Email'}</h1>
                  <p style={styles.subtitle}>Enter the 6-digit code sent to {email}</p>
                </div>
              </div>
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Verification Code</label>
                  <div style={styles.otpContainer}>
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        id={`otp-${index}`}
                        type="text"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        style={styles.otpInput}
                      />
                    ))}
                  </div>
                </div>
                {error && (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    border: '1px solid #fecaca'
                  }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{
                    backgroundColor: '#f0fdf4',
                    color: '#16a34a',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    border: '1px solid #bbf7d0'
                  }}>
                    {success}
                  </div>
                )}
                <button style={{...styles.button, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer'}} onClick={handleVerify} disabled={loading}>
                  {loading ? 'Verifying...' : 'Verify & Continue'} <ArrowRight size={20} />
                </button>
                <div style={styles.resendText}>
                  Didn't receive the code?{' '}
                  <button style={styles.linkButton} onClick={handleResend} disabled={loading}>
                    Resend
                  </button>
                </div>
                <div style={styles.footer}>
                  Check your spam folder if you don't see the email.
                </div>
              </div>
              <button 
                style={styles.backButton}
                onClick={() => handleTransition(flow === 'reset' ? 'forgot-password' : 'signup')}
              >
                ← Back
              </button>
            </React.Fragment>
          )}
          {currentView === 'reset-password' && (
            <React.Fragment>
              <div style={styles.header}>
                <div style={styles.logoIcon}>
                  <Lock color="white" size={32} />
                </div>
                <div style={styles.headerText}>
                  <h1 style={styles.title}>Set New Password</h1>
                  <p style={styles.subtitle}>Choose a strong password</p>
                </div>
              </div>
              <div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    New Password
                    <span style={{ marginLeft: 6, cursor: 'pointer', position: 'relative' }}
                      onMouseEnter={() => setShowPasswordInfo(true)}
                      onMouseLeave={() => setShowPasswordInfo(false)}>
                      <Info size={16} color="#10b981" />
                      {showPasswordInfo && (
                        <div style={{
                          position: 'absolute',
                          left: 20,
                          top: 0,
                          background: '#fff',
                          color: '#222',
                          border: '1px solid #e5e7eb',
                          borderRadius: 6,
                          padding: '0.75rem',
                          fontSize: '0.95rem',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                          zIndex: 10,
                          minWidth: 220
                        }}>
                          <b>Password requirements:</b>
                          <ul style={{ margin: '0.5rem 0 0 0', padding: 0, listStyle: 'none' }}>
                            {passwordRequirements.map((req, i) => (
                              <li key={i} style={{ color: req.test(newPassword1) ? '#10b981' : '#dc2626', fontWeight: req.test(newPassword1) ? 600 : 400 }}>
                                {req.label}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </span>
                  </label>
                  <div style={styles.inputWrapper}>
                    <div style={styles.inputIcon}>
                      <Lock size={20} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={newPassword1}
                      onChange={(e) => setNewPassword1(e.target.value)}
                      style={styles.input}
                    />
                    <div 
                      style={styles.eyeIcon}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </div>
                  </div>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Confirm New Password</label>
                  <div style={styles.inputWrapper}>
                    <div style={styles.inputIcon}>
                      <Lock size={20} />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={newPassword2}
                      onChange={(e) => setNewPassword2(e.target.value)}
                      style={styles.input}
                    />
                    <div 
                      style={styles.eyeIcon}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </div>
                  </div>
                </div>
                {error && (
                  <div style={{
                    backgroundColor: '#fef2f2',
                    color: '#dc2626',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    border: '1px solid #fecaca'
                  }}>
                    {error}
                  </div>
                )}
                {success && (
                  <div style={{
                    backgroundColor: '#f0fdf4',
                    color: '#16a34a',
                    padding: '0.75rem',
                    borderRadius: '6px',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    border: '1px solid #bbf7d0'
                  }}>
                    {success}
                  </div>
                )}
                <button 
                  onClick={handleResetPassword}
                  style={{
                    ...styles.button,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Resetting...' : 'Reset Password'} <ArrowRight size={20} />
                </button>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                  <button 
                    style={styles.linkButton} 
                    onClick={() => handleTransition('login')}
                  >
                    Back to Login
                  </button>
                </div>
              </div>
              <button 
                style={styles.backButton}
                onClick={() => handleTransition('otp')}
              >
                ← Back
              </button>
            </React.Fragment>
          )}
        </div>
      </div>
    </div>
  );
};

export default FasalGuardAuth;