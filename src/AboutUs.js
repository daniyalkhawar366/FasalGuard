import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  ChevronRight,
  CloudSun,
  Droplets,
  Leaf,
  MapPinned,
  ShieldCheck,
  Sprout,
  Satellite,
  SunMedium,
  Tractor,
} from 'lucide-react';

const navigationItems = [
  { label: 'About Us', path: '/about', active: true },
  { label: 'Services', path: '/services' },
  { label: 'Contact Us', path: '/contact' },
];

const featureCards = [
  {
    icon: <Satellite size={18} />,
    title: 'Real-time Observation',
    description: 'Track field health continuously with satellite-backed indicators that make crop stress visible earlier.',
    image: '/about_bg.png',
  },
  {
    icon: <BarChart3 size={18} />,
    title: 'Data Analytics',
    description: 'Turn soil, weather, and imagery into clear recommendations for irrigation, treatment, and planning.',
    image: '/services_bg.png',
  },
  {
    icon: <Sprout size={18} />,
    title: 'Sustainable Growth',
    description: 'Support better yield decisions while reducing waste, overuse, and avoidable farm risk.',
    image: '/satellite_bg.png',
  },
];

const valueCards = [
  {
    title: 'Precision Mapping',
    description: 'We combine live environmental signals with remote sensing to highlight the exact field zones that need attention.',
    icon: <MapPinned size={20} />,
    image: '/about_bg.png',
  },
  {
    title: 'Soil Intelligence',
    description: 'FasalGuard connects soil behavior, moisture needs, and nutrient balancing into a single practical view.',
    icon: <Droplets size={20} />,
    image: '/services_bg.png',
  },
  {
    title: 'Weather-Aware Planning',
    description: 'Forecast-driven decisions help farmers time irrigation, spraying, and harvesting with less guesswork.',
    icon: <CloudSun size={20} />,
    image: '/contact_bg.png',
  },
  {
    title: 'Field Confidence',
    description: 'The platform keeps the focus on usable farm action, not noisy dashboards or cluttered interfaces.',
    icon: <ShieldCheck size={20} />,
    image: '/account_bg.png',
  },
];

export default function AboutUs() {
  const navigate = useNavigate();

  const go = (path) => navigate(path);

  const styles = {
    page: {
      minHeight: '100vh',
      background: 'radial-gradient(circle at top, #effaf1 0%, #f6fbf4 40%, #edf7ea 100%)',
      color: '#0f172a',
      overflowX: 'hidden',
      fontFamily: 'Inter, Arial, sans-serif',
    },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      backdropFilter: 'blur(18px)',
      background: 'rgba(247, 248, 242, 0.9)',
      borderBottom: '1px solid rgba(15, 23, 42, 0.08)',
    },
    headerInner: {
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '14px 22px',
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
      cursor: 'pointer',
      padding: 0,
      color: '#0f172a',
      fontWeight: 900,
      letterSpacing: '-0.04em',
      fontSize: '1.02rem',
    },
    brandMark: {
      width: '34px',
      height: '34px',
      borderRadius: '999px',
      display: 'grid',
      placeItems: 'center',
      background: 'linear-gradient(135deg, #d9f99d 0%, #86efac 100%)',
      color: '#166534',
      boxShadow: '0 10px 24px rgba(22, 101, 52, 0.18)',
    },
    nav: {
      display: 'flex',
      alignItems: 'center',
      gap: '18px',
      flexWrap: 'wrap',
    },
    navButton: {
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      padding: 0,
      fontSize: '0.92rem',
      color: '#475569',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    navButtonActive: {
      color: '#166534',
      position: 'relative',
    },
    navUnderline: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: '-6px',
      height: '2px',
      borderRadius: '999px',
      background: '#166534',
    },
    accountButton: {
      border: 'none',
      background: 'linear-gradient(135deg, #bbf7d0 0%, #86efac 100%)',
      color: '#166534',
      width: '38px',
      height: '38px',
      borderRadius: '999px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      boxShadow: '0 10px 24px rgba(22, 101, 52, 0.16)',
    },
    hero: {
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '16px 22px 0',
    },
    heroCard: {
      minHeight: '320px',
      borderRadius: '28px',
      overflow: 'hidden',
      position: 'relative',
      background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.98), rgba(34, 197, 94, 0.68))',
      boxShadow: '0 24px 60px rgba(6, 95, 70, 0.18)',
    },
    heroImage: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: 0.34,
      filter: 'saturate(1.08) contrast(1.02)',
    },
    heroOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(90deg, rgba(4, 44, 27, 0.92) 0%, rgba(4, 44, 27, 0.62) 40%, rgba(4, 44, 27, 0.12) 100%)',
    },
    heroContent: {
      position: 'relative',
      zIndex: 2,
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.05fr) minmax(280px, 0.95fr)',
      gap: '28px',
      alignItems: 'center',
      minHeight: '320px',
      padding: '34px',
    },
    heroText: {
      maxWidth: '620px',
      color: '#fff',
    },
    eyebrow: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '999px',
      background: 'rgba(255, 255, 255, 0.12)',
      border: '1px solid rgba(255, 255, 255, 0.14)',
      fontSize: '0.72rem',
      letterSpacing: '0.22em',
      textTransform: 'uppercase',
      fontWeight: 800,
      marginBottom: '16px',
    },
    heroTitle: {
      margin: 0,
      fontSize: 'clamp(2.3rem, 4vw, 4.5rem)',
      lineHeight: 1.02,
      letterSpacing: '-0.07em',
      textWrap: 'balance',
    },
    heroCopy: {
      margin: '16px 0 0',
      maxWidth: '34rem',
      fontSize: '1rem',
      lineHeight: 1.7,
      color: 'rgba(255,255,255,0.84)',
    },
    heroActions: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '12px',
      marginTop: '24px',
    },
    primaryAction: {
      border: 'none',
      borderRadius: '14px',
      background: '#f8fafc',
      color: '#0f172a',
      padding: '13px 18px',
      fontWeight: 800,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 16px 30px rgba(15, 23, 42, 0.16)',
    },
    secondaryAction: {
      borderRadius: '14px',
      border: '1px solid rgba(255,255,255,0.34)',
      background: 'rgba(6, 95, 70, 0.16)',
      color: '#fff',
      padding: '13px 18px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    heroVisual: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '14px',
      alignItems: 'stretch',
    },
    visualPanel: {
      borderRadius: '24px',
      overflow: 'hidden',
      position: 'relative',
      background: 'rgba(255,255,255,0.08)',
      border: '1px solid rgba(255,255,255,0.14)',
      minHeight: '150px',
      boxShadow: '0 20px 40px rgba(0,0,0,0.16)',
    },
    visualImage: {
      width: '100%',
      height: '100%',
      minHeight: '150px',
      objectFit: 'cover',
      display: 'block',
    },
    imageStrip: {
      width: '100%',
      height: '116px',
      objectFit: 'cover',
      display: 'block',
      borderRadius: '14px',
      marginBottom: '14px',
      boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)',
    },
    visualBadge: {
      position: 'absolute',
      left: '16px',
      bottom: '16px',
      padding: '10px 12px',
      borderRadius: '14px',
      background: 'rgba(4, 43, 27, 0.82)',
      color: '#fff',
      fontSize: '0.9rem',
      fontWeight: 700,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
    },
    section: {
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '28px 22px 0',
    },
    sectionLabel: {
      fontSize: '0.7rem',
      color: '#0f7a46',
      letterSpacing: '0.32em',
      textTransform: 'uppercase',
      fontWeight: 900,
      marginBottom: '8px',
    },
    sectionHeading: {
      margin: 0,
      fontSize: 'clamp(1.8rem, 3vw, 2.8rem)',
      letterSpacing: '-0.06em',
      color: '#0f172a',
    },
    sectionIntro: {
      margin: '10px 0 0',
      maxWidth: '54rem',
      color: '#475569',
      lineHeight: 1.7,
      fontSize: '0.98rem',
    },
    featureGrid: {
      marginTop: '22px',
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '18px',
    },
    featureCard: {
      background: '#fff',
      borderRadius: '18px',
      border: '1px solid rgba(15, 23, 42, 0.08)',
      padding: '18px',
      minHeight: '278px',
      boxShadow: '0 14px 34px rgba(15, 23, 42, 0.06)',
    },
    featureIcon: {
      width: '34px',
      height: '34px',
      borderRadius: '12px',
      background: '#eef9f0',
      color: '#0f7a46',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '18px',
    },
    featureTitle: {
      margin: 0,
      fontSize: '1.02rem',
      letterSpacing: '-0.03em',
    },
    featureText: {
      margin: '10px 0 0',
      color: '#64748b',
      lineHeight: 1.65,
      fontSize: '0.92rem',
    },
    splitSection: {
      marginTop: '46px',
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 0.95fr)',
      gap: '18px',
      alignItems: 'stretch',
    },
    tallCard: {
      borderRadius: '22px',
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #0b3f2e 0%, #0f5f42 100%)',
      position: 'relative',
      minHeight: '340px',
      boxShadow: '0 24px 52px rgba(7, 86, 56, 0.2)',
    },
    tallImage: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      opacity: 0.28,
    },
    tallOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(3, 28, 18, 0.2) 0%, rgba(3, 28, 18, 0.8) 100%)',
    },
    tallContent: {
      position: 'relative',
      zIndex: 2,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-end',
      height: '100%',
      padding: '22px',
      color: '#fff',
    },
    tallTitle: {
      margin: 0,
      fontSize: '1.5rem',
      letterSpacing: '-0.05em',
    },
    tallText: {
      margin: '8px 0 0',
      maxWidth: '34rem',
      lineHeight: 1.65,
      color: 'rgba(255,255,255,0.82)',
      fontSize: '0.95rem',
    },
    miniGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '18px',
    },
    miniCard: {
      background: '#fff',
      borderRadius: '18px',
      border: '1px solid rgba(15, 23, 42, 0.08)',
      padding: '20px',
      boxShadow: '0 14px 34px rgba(15, 23, 42, 0.06)',
      minHeight: '250px',
    },
    miniImage: {
      width: '100%',
      height: '104px',
      objectFit: 'cover',
      display: 'block',
      borderRadius: '14px',
      marginBottom: '14px',
    },
    miniIcon: {
      width: '40px',
      height: '40px',
      borderRadius: '14px',
      background: '#ecfdf5',
      color: '#166534',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '16px',
    },
    miniTitle: {
      margin: 0,
      fontSize: '1rem',
      letterSpacing: '-0.03em',
    },
    miniText: {
      margin: '8px 0 0',
      lineHeight: 1.6,
      color: '#64748b',
      fontSize: '0.92rem',
    },
    cta: {
      marginTop: '46px',
      paddingBottom: '34px',
    },
    ctaPanel: {
      borderRadius: '24px',
      padding: '28px',
      background: 'linear-gradient(135deg, #e8fff1 0%, #dcfce7 52%, #c7f9d0 100%)',
      border: '1px solid rgba(15, 23, 42, 0.08)',
      boxShadow: '0 18px 44px rgba(15, 23, 42, 0.06)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '18px',
      flexWrap: 'wrap',
    },
    ctaTitle: {
      margin: 0,
      fontSize: '1.65rem',
      letterSpacing: '-0.05em',
    },
    ctaText: {
      margin: '8px 0 0',
      color: '#475569',
      lineHeight: 1.65,
      maxWidth: '40rem',
    },
    ctaButton: {
      border: 'none',
      borderRadius: '14px',
      background: 'linear-gradient(135deg, #14532d 0%, #166534 100%)',
      color: '#fff',
      padding: '13px 18px',
      fontWeight: 800,
      cursor: 'pointer',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      boxShadow: '0 16px 30px rgba(22, 101, 52, 0.2)',
    },
    footer: {
      maxWidth: '1280px',
      margin: '0 auto',
      padding: '0 22px 24px',
      color: '#64748b',
      fontSize: '0.85rem',
    },
    footerRow: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
      paddingTop: '8px',
      borderTop: '1px solid rgba(15, 23, 42, 0.08)',
    },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <button type="button" style={styles.brand} onClick={() => go('/home')}>
            <span style={styles.brandMark}><Leaf size={18} /></span>
            FasalGuard
          </button>

          <nav style={styles.nav} aria-label="Main navigation">
            {navigationItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => go(item.path)}
                style={{
                  ...styles.navButton,
                  ...(item.active ? styles.navButtonActive : null),
                }}
              >
                {item.label}
                {item.active && <span style={styles.navUnderline} />}
              </button>
            ))}
          </nav>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button type="button" style={styles.navButton} onClick={() => go('/contact')}>Contact Us</button>
            <button type="button" style={styles.accountButton} onClick={() => go('/profile')} aria-label="Account">
              <SunMedium size={18} />
            </button>
          </div>
        </div>
      </header>

      <main>
        <section style={styles.hero}>
          <div style={styles.heroCard}>
            <img src="/about_bg.png" alt="Green agricultural field" style={styles.heroImage} />
            <div style={styles.heroOverlay} />
            <div style={styles.heroContent}>
              <div style={styles.heroText}>
                <div style={styles.eyebrow}>
                  <Tractor size={14} />
                  Precision agriculture for FasalGuard
                </div>
                <h1 style={styles.heroTitle}>Bridging satellite intelligence and healthy soil decisions.</h1>
                <p style={styles.heroCopy}>
                  FasalGuard helps farmers read crop conditions more clearly with satellite analysis, soil insights,
                  weather context, and practical guidance that stays focused on the field.
                </p>
                <div style={styles.heroActions}>
                  <button type="button" style={styles.primaryAction} onClick={() => go('/satellite-analysis')}>
                    Explore Platform <ArrowRight size={17} />
                  </button>
                  <button type="button" style={styles.secondaryAction} onClick={() => go('/contact')}>
                    Request Demo
                  </button>
                </div>
              </div>

              <div style={styles.heroVisual}>
                <div style={styles.visualPanel}>
                  <img src="/about_bg.png" alt="Agricultural illustration" style={styles.visualImage} />
                  <div style={styles.visualBadge}><Satellite size={16} /> Live crop monitoring</div>
                </div>
                <div style={styles.visualPanel}>
                  <img src="/contact_bg.png" alt="Healthy wheat field" style={styles.visualImage} />
                </div>
                <div style={styles.visualPanel}>
                  <img src="/account_bg.png" alt="Rice crop field" style={styles.visualImage} />
                </div>
                <div style={styles.visualPanel}>
                  <img src="/satellite_bg.png" alt="Sugarcane crop field" style={styles.visualImage} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionLabel}>Our Purpose</div>
          <h2 style={styles.sectionHeading}>Precision for a sustainable future</h2>
          <p style={styles.sectionIntro}>
            The platform is designed to stay readable and practical. Instead of a long text bar, the story is broken into
            short, high-signal blocks with agriculture-first visuals and a clean layout.
          </p>

          <div style={styles.featureGrid}>
            {featureCards.map((card) => (
              <article key={card.title} style={styles.featureCard}>
                <img src={card.image} alt={card.title} style={styles.imageStrip} />
                <div style={styles.featureIcon}>{card.icon}</div>
                <h3 style={styles.featureTitle}>{card.title}</h3>
                <p style={styles.featureText}>{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={{ display: 'flex', alignItems: 'end', justifyContent: 'space-between', gap: '18px', flexWrap: 'wrap' }}>
            <div>
              <div style={styles.sectionLabel}>Technology Stack</div>
              <h2 style={styles.sectionHeading}>Engineered for farm-scale clarity</h2>
            </div>
            <p style={{ ...styles.sectionIntro, maxWidth: '34rem', marginTop: 0 }}>
              FasalGuard keeps the presentation compact while still showing the essential layers farmers need before they act.
            </p>
          </div>

          <div style={styles.splitSection}>
            <div style={styles.tallCard}>
              <img src="/services_bg.png" alt="Green crop field background" style={styles.tallImage} />
              <div style={styles.tallOverlay} />
              <div style={styles.tallContent}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#bbf7d0', fontSize: '0.72rem', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 900 }}>
                  <Leaf size={14} /> Predictive farming
                </div>
                <h3 style={styles.tallTitle}>One view for imagery, weather, soil, and recommendations.</h3>
                <p style={styles.tallText}>
                  The platform turns raw agricultural data into concise actions so farmers can respond faster and with more confidence.
                </p>
              </div>
            </div>

            <div style={styles.miniGrid}>
              {valueCards.map((item) => (
                <article key={item.title} style={styles.miniCard}>
                  <img src={item.image} alt={item.title} style={styles.miniImage} />
                  <div style={styles.miniIcon}>{item.icon}</div>
                  <h3 style={styles.miniTitle}>{item.title}</h3>
                  <p style={styles.miniText}>{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.cta}>
            <div style={styles.ctaPanel}>
              <div>
                <h2 style={styles.ctaTitle}>Join the Future of Farming</h2>
                <p style={styles.ctaText}>
                  Ready to see your fields through a cleaner lens? Start with satellite analysis and move from data to action.
                </p>
              </div>
              <button type="button" style={styles.ctaButton} onClick={() => go('/satellite-analysis')}>
                Schedule a Personal Tour <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <div style={styles.footerRow}>
          <div>
            <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>FasalGuard</div>
            <div>Precision agricultural intelligence, designed for practical field decisions.</div>
          </div>
          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap' }}>
            <button type="button" style={styles.navButton} onClick={() => go('/contact')}>Privacy Policy</button>
            <button type="button" style={styles.navButton} onClick={() => go('/contact')}>Terms of Service</button>
            <button type="button" style={styles.navButton} onClick={() => go('/satellite-analysis')}>Technology Stack</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
