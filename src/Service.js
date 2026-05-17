import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, ShieldCheck, SunMedium, Droplets, Satellite, BarChart3 } from 'lucide-react';

const serviceCards = [
  {
    id: 1,
    title: 'Crop Health Monitoring',
    description:
      'Using high-resolution satellite indicators and vegetation signals to detect crop stress, nutrient gaps, and early pest pressure before it spreads.',
    bullets: ['Daily field visibility', 'Early stress detection', 'Satellite-driven alerts'],
    actionLabel: 'Explore Capability',
    actionRoute: '/satellite-analysis',
    icon: <Satellite size={26} />,
    variant: 'feature',
    image: '/service_satellite.png',
  },
  {
    id: 2,
    title: 'Soil Moisture Analysis',
    description:
      'Track soil moisture and field conditions to guide irrigation timing, reduce water waste, and keep crops stable through hot periods.',
    bullets: ['Water-use guidance', 'Moisture insights', 'Irrigation planning'],
    actionLabel: 'Open Soil Analysis',
    actionRoute: '/soil-analysis',
    icon: <Droplets size={26} />,
    variant: 'card',
    image: '/service_soil.png',
  },
  {
    id: 3,
    title: 'Weather Intelligence',
    description:
      'Get weather-aware farming guidance with forecast-driven alerts for heat, rain, and wind so field operations are timed better.',
    bullets: ['7-day forecasts', 'Risk alerts', 'Farm planning support'],
    actionLabel: 'View Weather Tools',
    actionRoute: '/crop-prediction',
    icon: <SunMedium size={26} />,
    variant: 'card',
    image: '/service_weather.png',
  },
  {
    id: 4,
    title: 'Yield Prediction',
    description:
      'Use FasalGuard forecasting to estimate outcomes from crop health, weather, and historical patterns for better farm decisions.',
    bullets: ['Yield outlook', 'Decision support', 'Harvest planning'],
    actionLabel: 'View Sample Report',
    actionRoute: '/prediction-results/report',
    icon: <BarChart3 size={26} />,
    variant: 'highlight',
    image: '/service_yield.png',
  },
];

const stats = [
  { value: '4', label: 'Core FasalGuard Services' },
  { value: '24/7', label: 'Monitoring and Alerts' },
  { value: '1', label: 'Unified Platform' },
];

const Services = () => {
  const navigate = useNavigate();

  const styles = {
    page: {
      minHeight: '100vh',
      background: '#f7f8fb',
      color: '#0f172a',
      fontFamily: 'Inter, Arial, sans-serif',
    },
    header: {
      position: 'sticky',
      top: 0,
      zIndex: 30,
      background: 'rgba(247, 248, 251, 0.92)',
      backdropFilter: 'blur(14px)',
      borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
    },
    headerInner: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: '18px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '16px',
    },
    brand: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontWeight: 800,
      letterSpacing: '-0.03em',
      fontSize: '1.1rem',
      color: '#0f3d2e',
    },
    nav: {
      display: 'flex',
      gap: '26px',
      alignItems: 'center',
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
      padding: '56px 24px 28px',
    },
    heroGrid: {
      display: 'grid',
      gridTemplateColumns: '1.2fr 0.8fr',
      gap: '20px',
      alignItems: 'stretch',
      marginTop: '8px',
    },
    heroVisual: {
      borderRadius: '26px',
      overflow: 'hidden',
      minHeight: '340px',
      position: 'relative',
      background: 'linear-gradient(135deg, #0f5132 0%, #123826 100%)',
      boxShadow: '0 22px 55px rgba(15, 83, 50, 0.22)',
    },
    heroVisualImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      opacity: 0.92,
      filter: 'saturate(1.05) contrast(1.02)',
    },
    heroVisualOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(7, 20, 14, 0.08) 0%, rgba(7, 20, 14, 0.54) 100%)',
    },
    heroVisualCaption: {
      position: 'absolute',
      left: '18px',
      right: '18px',
      bottom: '18px',
      color: '#f8fafc',
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      alignItems: 'end',
      flexWrap: 'wrap',
    },
    heroVisualCaptionText: {
      maxWidth: '280px',
      fontSize: '0.95rem',
      lineHeight: 1.6,
      color: 'rgba(248, 250, 252, 0.9)',
    },
    heroPills: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(110px, 1fr))',
      gap: '10px',
      width: '240px',
    },
    heroPill: {
      background: 'rgba(255,255,255,0.14)',
      border: '1px solid rgba(255,255,255,0.16)',
      color: '#fff',
      borderRadius: '14px',
      padding: '10px 12px',
      backdropFilter: 'blur(10px)',
    },
    heroPillLabel: {
      fontSize: '0.72rem',
      textTransform: 'uppercase',
      letterSpacing: '0.16em',
      opacity: 0.7,
    },
    heroPillValue: {
      fontSize: '0.92rem',
      fontWeight: 800,
      marginTop: '4px',
    },
    heroGallery: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '16px',
      minHeight: '340px',
    },
    galleryTile: {
      borderRadius: '22px',
      overflow: 'hidden',
      position: 'relative',
      boxShadow: '0 18px 40px rgba(15, 23, 42, 0.08)',
      background: '#fff',
    },
    galleryTileTall: {
      gridRow: 'span 2',
      minHeight: '340px',
    },
    galleryTileImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
    },
    galleryOverlay: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(7, 20, 14, 0) 20%, rgba(7, 20, 14, 0.44) 100%)',
    },
    galleryText: {
      position: 'absolute',
      left: '14px',
      right: '14px',
      bottom: '14px',
      color: '#fff',
      fontSize: '0.88rem',
      fontWeight: 700,
      lineHeight: 1.5,
    },
    eyebrow: {
      color: '#0f5132',
      fontSize: '0.72rem',
      letterSpacing: '0.22em',
      fontWeight: 800,
      marginBottom: '14px',
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
      lineHeight: 1.03,
      margin: 0,
      maxWidth: '920px',
      letterSpacing: '-0.05em',
    },
    subtitle: {
      maxWidth: '740px',
      marginTop: '18px',
      fontSize: '1.08rem',
      lineHeight: 1.75,
      color: '#475569',
    },
    statsRow: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '16px',
      marginTop: '30px',
    },
    statCard: {
      background: '#fff',
      borderRadius: '18px',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      padding: '18px 20px',
      boxShadow: '0 18px 40px rgba(15, 23, 42, 0.05)',
    },
    statValue: {
      fontSize: '2rem',
      fontWeight: 800,
      color: '#0f3d2e',
      marginBottom: '4px',
    },
    statLabel: {
      fontSize: '0.9rem',
      color: '#64748b',
    },
    content: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: '18px 24px 72px',
    },
    grid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: '18px',
      marginTop: '10px',
    },
    card: {
      background: '#fff',
      borderRadius: '18px',
      border: '1px solid rgba(148, 163, 184, 0.18)',
      boxShadow: '0 18px 40px rgba(15, 23, 42, 0.05)',
      padding: '26px',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      minHeight: '240px',
      overflow: 'hidden',
    },
    featureCard: {
      gridColumn: 'span 7',
      minHeight: '320px',
      background: 'linear-gradient(135deg, #ffffff 0%, #f4f7f0 100%)',
      overflow: 'hidden',
      position: 'relative',
    },
    sideCard: {
      gridColumn: 'span 5',
      minHeight: '320px',
    },
    smallCard: {
      gridColumn: 'span 4',
    },
    highlightCard: {
      gridColumn: 'span 8',
      background: 'linear-gradient(135deg, #0b5135 0%, #063d28 100%)',
      color: '#ecfdf5',
      minHeight: '240px',
      border: 'none',
    },
    cardTop: {
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      marginBottom: '16px',
    },
    cardImageWrap: {
      height: '176px',
      margin: '-26px -26px 20px',
      position: 'relative',
      overflow: 'hidden',
      background: '#dde9e1',
    },
    cardImage: {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      display: 'block',
      filter: 'saturate(1.05) contrast(1.02)',
    },
    cardImageShade: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(180deg, rgba(7,20,14,0.05) 0%, rgba(7,20,14,0.46) 100%)',
    },
    cardImageTag: {
      position: 'absolute',
      left: '16px',
      bottom: '16px',
      color: '#fff',
      fontWeight: 800,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      fontSize: '0.72rem',
      background: 'rgba(15, 83, 50, 0.72)',
      padding: '8px 10px',
      borderRadius: '999px',
      border: '1px solid rgba(255,255,255,0.16)',
    },
    icon: {
      width: '44px',
      height: '44px',
      borderRadius: '12px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#eff6f2',
      color: '#0f5132',
      flexShrink: 0,
    },
    cardTitle: {
      fontSize: '1.35rem',
      lineHeight: 1.15,
      margin: 0,
      letterSpacing: '-0.03em',
    },
    cardText: {
      fontSize: '0.98rem',
      lineHeight: 1.7,
      color: 'inherit',
      opacity: 0.88,
      margin: '0 0 18px',
      maxWidth: '55ch',
    },
    bullets: {
      display: 'grid',
      gap: '10px',
      margin: '0 0 22px',
      padding: 0,
      listStyle: 'none',
    },
    bullet: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '0.94rem',
      color: 'inherit',
    },
    action: {
      marginTop: 'auto',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '10px',
      width: 'fit-content',
      border: '1px solid currentColor',
      borderRadius: '12px',
      padding: '12px 16px',
      background: 'transparent',
      cursor: 'pointer',
      fontWeight: 700,
    },
    miniPanel: {
      position: 'absolute',
      right: '22px',
      top: '50%',
      transform: 'translateY(-50%)',
      width: '160px',
      height: '120px',
      borderRadius: '14px',
      background: 'linear-gradient(180deg, rgba(15, 61, 46, 0.14), rgba(15, 61, 46, 0.03))',
      display: 'flex',
      alignItems: 'end',
      justifyContent: 'center',
      padding: '14px',
    },
    miniBars: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5, 1fr)',
      gap: '8px',
      width: '100%',
      alignItems: 'end',
    },
    bar: {
      borderRadius: '8px 8px 0 0',
      background: 'linear-gradient(180deg, #98f5c5 0%, #60e0a4 100%)',
    },
    cta: {
      marginTop: '26px',
      background: '#dfe9ff',
      borderRadius: '20px',
      padding: '36px 20px',
      textAlign: 'center',
      border: '1px solid rgba(59, 130, 246, 0.08)',
    },
    ctaTitle: {
      margin: 0,
      fontSize: '1.9rem',
      letterSpacing: '-0.04em',
    },
    ctaText: {
      margin: '12px auto 0',
      maxWidth: '760px',
      color: '#475569',
      lineHeight: 1.7,
      fontSize: '1rem',
    },
    ctaButtons: {
      marginTop: '20px',
      display: 'flex',
      gap: '12px',
      justifyContent: 'center',
      flexWrap: 'wrap',
    },
    primaryBtn: {
      background: '#0f5132',
      color: '#fff',
      border: 'none',
      borderRadius: '10px',
      padding: '13px 18px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    secondaryBtn: {
      background: '#fff',
      color: '#0f172a',
      border: '1px solid rgba(148, 163, 184, 0.28)',
      borderRadius: '10px',
      padding: '13px 18px',
      fontWeight: 800,
      cursor: 'pointer',
    },
    footer: {
      maxWidth: '1180px',
      margin: '0 auto',
      padding: '26px 24px 34px',
      color: '#64748b',
      display: 'flex',
      justifyContent: 'space-between',
      gap: '16px',
      flexWrap: 'wrap',
      borderTop: '1px solid rgba(148, 163, 184, 0.16)',
    },
    footerLinks: {
      display: 'flex',
      gap: '22px',
      flexWrap: 'wrap',
    },
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.headerInner}>
          <button type="button" onClick={() => navigate('/home')} style={{ ...styles.brand, background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <Leaf size={22} />
            <span>FasalGuard</span>
          </button>
          <nav style={styles.nav}>
            <button type="button" style={styles.navLink} onClick={() => navigate('/services')}>Services</button>
            <button type="button" style={styles.navLink} onClick={() => navigate('/about')}>About Us</button>
            <button type="button" style={styles.navLink} onClick={() => navigate('/contact')}>Contact Us</button>
            <button type="button" style={styles.accountBtn} onClick={() => navigate('/profile')} aria-label="Account">
              <ShieldCheck size={18} />
            </button>
          </nav>
        </div>
      </header>

      <section style={styles.hero}>
        <div style={styles.heroGrid}>
          <div>
            <div style={styles.eyebrow}>Precision Intelligence</div>
            <h1 style={styles.title}>FasalGuard services built for field decisions.</h1>
            <p style={styles.subtitle}>
              Everything on this page stays inside the FasalGuard ecosystem: satellite insights, soil checks, weather guidance, and yield prediction that support day-to-day farm decisions.
            </p>

            <div style={styles.statsRow}>
              {stats.map((item) => (
                <div key={item.label} style={styles.statCard}>
                  <div style={styles.statValue}>{item.value}</div>
                  <div style={styles.statLabel}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={styles.heroGallery}>
            <div style={{ ...styles.galleryTile, ...styles.galleryTileTall }}>
              <img src="/service_smart.png" alt="FasalGuard farm intelligence" style={styles.galleryTileImage} />
              <div style={styles.galleryOverlay} />
              <div style={styles.galleryText}>Satellite imagery and field intelligence for smarter crop action.</div>
            </div>
            <div style={styles.galleryTile}>
              <img src="/service_hero_wheat.png" alt="Wheat field" style={styles.galleryTileImage} />
              <div style={styles.galleryOverlay} />
              <div style={styles.galleryText}>Healthy crop textures and field coverage.</div>
            </div>
            <div style={styles.galleryTile}>
              <img src="/service_hero_rice.png" alt="Rice field" style={styles.galleryTileImage} />
              <div style={styles.galleryOverlay} />
              <div style={styles.galleryText}>Visual crop intelligence tuned for farms.</div>
            </div>
            <div style={styles.galleryTile}>
              <img src="/service_hero_maize.png" alt="Maize crop" style={styles.galleryTileImage} />
              <div style={styles.galleryOverlay} />
              <div style={styles.galleryText}>Field-level planning for crop growth and yield.</div>
            </div>
          </div>
        </div>
      </section>

      <section style={styles.content}>
        <div style={styles.grid}>
          <article style={{ ...styles.card, ...styles.featureCard }}>
            <div style={styles.cardImageWrap}>
              <img src={serviceCards[0].image} alt={serviceCards[0].title} style={styles.cardImage} />
              <div style={styles.cardImageShade} />
              <div style={styles.cardImageTag}>Satellite focus</div>
            </div>
            <div>
              <div style={styles.cardTop}>
                <div style={styles.icon}>{serviceCards[0].icon}</div>
                <div>
                  <h2 style={styles.cardTitle}>{serviceCards[0].title}</h2>
                </div>
              </div>
              <p style={styles.cardText}>{serviceCards[0].description}</p>
              <ul style={styles.bullets}>
                {serviceCards[0].bullets.map((bullet) => (
                  <li key={bullet} style={styles.bullet}><CheckMark />{bullet}</li>
                ))}
              </ul>
              <button type="button" style={{ ...styles.action, color: '#0f5132' }} onClick={() => navigate(serviceCards[0].actionRoute)}>
                {serviceCards[0].actionLabel} <ArrowRight size={16} />
              </button>
            </div>
            <div style={styles.miniPanel} aria-hidden="true">
              <div style={styles.miniBars}>
                {[34, 52, 68, 84, 60].map((height, index) => (
                  <div key={index} style={{ ...styles.bar, height: `${height}%` }} />
                ))}
              </div>
            </div>
          </article>

          <article style={{ ...styles.card, ...styles.sideCard }}>
            <div style={styles.cardImageWrap}>
              <img src={serviceCards[1].image} alt={serviceCards[1].title} style={styles.cardImage} />
              <div style={styles.cardImageShade} />
              <div style={styles.cardImageTag}>Soil first</div>
            </div>
            <div>
              <div style={styles.cardTop}>
                <div style={styles.icon}>{serviceCards[1].icon}</div>
                <h2 style={styles.cardTitle}>{serviceCards[1].title}</h2>
              </div>
              <p style={styles.cardText}>{serviceCards[1].description}</p>
              <ul style={styles.bullets}>
                {serviceCards[1].bullets.map((bullet) => (
                  <li key={bullet} style={styles.bullet}><CheckMark />{bullet}</li>
                ))}
              </ul>
            </div>
            <button type="button" style={{ ...styles.action, color: '#0f5132' }} onClick={() => navigate(serviceCards[1].actionRoute)}>
              {serviceCards[1].actionLabel} <ArrowRight size={16} />
            </button>
          </article>

          <article style={{ ...styles.card, ...styles.smallCard }}>
            <div style={styles.cardImageWrap}>
              <img src={serviceCards[2].image} alt={serviceCards[2].title} style={styles.cardImage} />
              <div style={styles.cardImageShade} />
              <div style={styles.cardImageTag}>Weather ready</div>
            </div>
            <div style={styles.cardTop}>
              <div style={styles.icon}>{serviceCards[2].icon}</div>
              <h2 style={styles.cardTitle}>{serviceCards[2].title}</h2>
            </div>
            <p style={styles.cardText}>{serviceCards[2].description}</p>
            <div style={{ display: 'grid', gap: '8px', marginBottom: '20px' }}>
              {serviceCards[2].bullets.map((bullet) => (
                <div key={bullet} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '0.94rem' }}>
                  <CheckMark /> {bullet}
                </div>
              ))}
            </div>
            <button type="button" style={{ ...styles.action, color: '#0f5132' }} onClick={() => navigate(serviceCards[2].actionRoute)}>
              {serviceCards[2].actionLabel} <ArrowRight size={16} />
            </button>
          </article>

          <article style={{ ...styles.card, ...styles.highlightCard }}>
            <div style={styles.cardImageWrap}>
              <img src={serviceCards[3].image} alt={serviceCards[3].title} style={styles.cardImage} />
              <div style={styles.cardImageShade} />
              <div style={styles.cardImageTag}>Yield planning</div>
            </div>
            <div style={styles.cardTop}>
              <div style={{ ...styles.icon, background: 'rgba(255,255,255,0.12)', color: '#ecfdf5' }}>{serviceCards[3].icon}</div>
              <h2 style={{ ...styles.cardTitle, color: '#ecfdf5' }}>{serviceCards[3].title}</h2>
            </div>
            <p style={{ ...styles.cardText, color: '#d1fae5' }}>{serviceCards[3].description}</p>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '22px' }}>
              {serviceCards[3].bullets.map((bullet) => (
                <div key={bullet} style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#d1fae5', fontSize: '0.96rem' }}>
                  <CheckMark dark /> {bullet}
                </div>
              ))}
            </div>
            <button type="button" style={{ ...styles.action, color: '#ecfdf5', borderColor: 'rgba(236, 253, 245, 0.45)' }} onClick={() => navigate(serviceCards[3].actionRoute)}>
              {serviceCards[3].actionLabel} <ArrowRight size={16} />
            </button>
          </article>
        </div>

        <div style={styles.cta}>
          <h2 style={styles.ctaTitle}>Ready to transform your farm management?</h2>
          <p style={styles.ctaText}>
            Stay inside FasalGuard for satellite intelligence, soil analysis, weather guidance, and yield planning. The backend stays unchanged, so the same API routes continue powering the platform.
          </p>
          <div style={styles.ctaButtons}>
            <button type="button" style={styles.primaryBtn} onClick={() => navigate('/satellite-analysis')}>Get Started Today</button>
            <button type="button" style={styles.secondaryBtn} onClick={() => navigate('/contact')}>Schedule a Demo</button>
          </div>
        </div>
      </section>

      <footer style={styles.footer}>
        <div style={{ fontWeight: 800, color: '#0f3d2e' }}>FasalGuard</div>
        <div>Satellite intelligence, soil insight, weather guidance, and yield support for farmers.</div>
      </footer>
    </div>
  );
};

const CheckMark = ({ dark = false }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: '999px',
    background: dark ? 'rgba(255,255,255,0.14)' : '#e7f5ee',
    color: dark ? '#b8f3cf' : '#0f5132',
    flexShrink: 0,
  }}>
    <Leaf size={11} />
  </span>
);

export default Services;
