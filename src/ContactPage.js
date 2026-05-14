import React, { useState, useEffect } from 'react';
import { Leaf } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const styles = {
  page: {
    minHeight: '100vh',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    color: '#222',
    padding: 0,
    margin: 0,
    display: 'flex',
    position: 'relative',
    overflowX: 'hidden',
  },
  leftSection: {
    flex: 1,
    padding: '4rem 6rem',
    background: '#f9fafb',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  rightSection: {
    flex: 1,
    background: '#e5e7eb',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: '2rem 3rem',
    zIndex: 100,
    display: 'flex',
    gap: '3rem',
    alignItems: 'center',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginRight: '2rem',
    cursor: 'pointer',
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
  navLink: {
    color: '#374151',
    fontSize: '0.85rem',
    fontWeight: 400,
    textDecoration: 'none',
    letterSpacing: '1px',
    cursor: 'pointer',
    transition: 'color 0.3s',
  },
  heading: {
    fontSize: '4rem',
    fontWeight: 300,
    color: '#111',
    marginBottom: '1.5rem',
    letterSpacing: '1px',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  },
  subheading: {
    fontSize: '1rem',
    color: '#6b7280',
    marginBottom: '3rem',
    fontWeight: 300,
  },
  emailLink: {
    color: '#10b981',
    textDecoration: 'none',
    fontWeight: 400,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    maxWidth: '600px',
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    width: '100%',
    padding: '1rem 0',
    fontSize: '1.1rem',
    fontWeight: 300,
    color: '#374151',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #d1d5db',
    outline: 'none',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    transition: 'border-color 0.3s',
  },
  textarea: {
    width: '100%',
    padding: '1rem 0',
    fontSize: '1.1rem',
    fontWeight: 300,
    color: '#374151',
    background: 'transparent',
    border: 'none',
    borderBottom: '1px solid #d1d5db',
    outline: 'none',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    minHeight: '100px',
    resize: 'none',
    transition: 'border-color 0.3s',
  },
  attachIcon: {
    position: 'absolute',
    right: '0.5rem',
    bottom: '1rem',
    color: '#9ca3af',
    cursor: 'pointer',
  },
  submitWrapper: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: '1rem',
  },
  submitBtn: {
    background: 'transparent',
    color: '#374151',
    border: 'none',
    padding: '0.5rem 0',
    fontSize: '1rem',
    fontWeight: 400,
    cursor: 'pointer',
    letterSpacing: '1px',
    fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    transition: 'color 0.3s',
  },
  arrow: {
    fontSize: '1.2rem',
    transition: 'transform 0.3s',
  },
  imageContainer: {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'stretch',
  justifyContent: 'stretch',
  padding: 0,
  },
  image: {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.1))',
  },
};

export default function ContactPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    setTimeout(() => setLoading(false), 400);
    const handleClick = (e) => {
      if (!e.target.closest('.profileIcon')) setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSending(true);
    setSuccess('');
    setError('');
    try {
      const res = await fetch(`${process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app'}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Message sent successfully!');
        setName('');
        setEmail('');
        setMessage('');
      } else {
        setError(data.error || 'Failed to send message.');
      }
    } catch (err) {
      setError('Failed to send message.');
    }
    setSending(false);
  };

  return (
    <div style={{ ...styles.page, opacity: loading ? 0 : 1, transition: 'opacity 0.6s cubic-bezier(.4,0,.2,1)' }}>
      <style>{`
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
        }
        ::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
        * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .input:focus, .textarea:focus {
          border-bottom-color: #10b981;
        }
        .input::placeholder, .textarea::placeholder {
          color: #d1d5db;
          font-weight: 300;
        }
        .navLink:hover {
          color: #10b981;
        }
        .submitBtn:hover {
          color: #10b981;
        }
        .submitBtn:hover .arrow {
          transform: translateX(5px);
        }
        .emailLink:hover {
          color: #059669;
        }
      `}</style>

      <header style={styles.header}>
        <div style={styles.logo} onClick={() => navigate('/home')} role="button" tabIndex={0} aria-label="Go to homepage">
          <span style={styles.logoIcon}>
            <Leaf size={20} color="#10b981" />
          </span>
          <span style={styles.logoText}>FASALGUARD</span>
        </div>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2rem' }}>
          <div style={{ position: 'relative' }}>
            {showDropdown && (
              <div style={{ position: 'absolute', right: 0, top: '2.5rem', background: '#fff', borderRadius: '0.5rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', minWidth: '120px', zIndex: 100 }}>
                <button style={{ width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: '#059669', cursor: 'pointer', textAlign: 'left' }} onClick={() => { setShowDropdown(false); navigate('/profile'); }}>Account</button>
                <button style={{ width: '100%', padding: '0.75rem 1rem', background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', textAlign: 'left' }} onClick={() => { setShowDropdown(false); navigate('/login'); }}>Logout</button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <div style={styles.leftSection}>
        <h1 style={styles.heading}>Contact Us</h1>
        <p style={styles.subheading}>
          Fill in the form, or, send us an email at <a href="mailto:info@fasalguard.com" style={styles.emailLink} className="emailLink">daniyalkhawar41@gmail.com</a>
        </p>

        <form style={styles.form} onSubmit={handleSubmit}>
          <div style={styles.inputWrapper}>
            <input
              type="text"
              placeholder="What's your name"
              style={styles.input}
              className="input"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          <div style={styles.inputWrapper}>
            <input
              type="email"
              placeholder="Your magical email"
              style={styles.input}
              className="input"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div style={styles.inputWrapper}>
            <textarea
              placeholder="Message"
              style={styles.textarea}
              className="textarea"
              value={message}
              onChange={e => setMessage(e.target.value)}
              required
            />
          </div>

          {error && <div style={{ color: '#dc2626', fontSize: '1rem', marginTop: '-1rem' }}>{error}</div>}
          {success && <div style={{ color: '#059669', fontSize: '1rem', marginTop: '-1rem' }}>{success}</div>}

          <div style={styles.submitWrapper}>
            <button type="submit" style={styles.submitBtn} className="submitBtn" disabled={sending}>
              {sending ? 'Sending...' : 'send'}
              <span style={styles.arrow} className="arrow">→</span>
            </button>
          </div>
        </form>
      </div>

      <div style={styles.rightSection}>
        <div style={styles.imageContainer}>
          <img 
            src='https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=85'
            alt="Agriculture technology"
            style={styles.image}
          />
        </div>
      </div>
    </div>
  );
}
