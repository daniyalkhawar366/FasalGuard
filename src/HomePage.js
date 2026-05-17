import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, ChevronDown, BarChart, Map, Sun, AlertCircle, CloudRain, Sprout, Shield, Cpu, Globe, TrendingUp, Users, Target, Clock, Database, Smartphone, Zap, CheckCircle, ArrowRight, Award, PieChart } from 'lucide-react';
import { motion, useAnimation, useInView } from 'framer-motion';

export default function HomePage({ onLogout, user }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();
  const [currentBg, setCurrentBg] = useState(0);
  const [activeSection, setActiveSection] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [cropNavLoading, setCropNavLoading] = useState(false);

  const backgroundImages = [
    'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=1920&q=85',
    'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=1920&q=85',
    'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1920&q=85',
    'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=1920&q=85',
    'https://images.unsplash.com/photo-1558818498-28c1e002b655?w=1920&q=85',
  ];

  // Farm images for sections
  const farmImages = {
    mission: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=1200&q=80',
    technology: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=1200&q=80',
    features: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=1200&q=80',
    precision: 'https://images.unsplash.com/photo-1464226184884-fa280b87c399?w=800&q=80',
    satellite: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800&q=80', // Aerial/satellite view
    aitech: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80', // Tech/AI related
    dataIntegration: 'https://images.unsplash.com/photo-1560493676-04071c5f467b?w=800&q=80', // Farm with modern tech
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentBg((prev) => (prev + 1) % backgroundImages.length);
    }, 7000);
    return () => clearInterval(interval);
  }, [backgroundImages.length]);

  useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY;
      setScrolled(scrollPosition > 100);
      const windowHeight = window.innerHeight;
      const section = Math.round(scrollPosition / windowHeight);
      setActiveSection(section);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setTimeout(() => setLoading(false), 400);
  }, []);

  useEffect(() => {
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

  const handleStartPrediction = () => {
    try {
      sessionStorage.setItem('cp_page_load', '1');
    } catch {
      // ignore storage errors
    }
    navigate('/satellite-analysis');
  };


  const styles = {
    page: {
      minHeight: '100vh',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      color: '#fff',
      padding: 0,
      margin: 0,
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      width: '100%',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    },
    bgImage: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      zIndex: -2,
      filter: 'brightness(0.65)',
      transition: 'opacity 1.5s ease-in-out',
    },
    bgOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      background: 'linear-gradient(135deg, rgba(10,40,20,0.4) 0%, rgba(20,50,30,0.5) 50%, rgba(10,40,20,0.4) 100%)',
      backgroundSize: '200% 200%',
      animation: 'gradientShift 15s ease infinite',
      zIndex: -1,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: scrolled ? '1rem 3rem' : '1.5rem 3rem',
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      background: scrolled ? 'rgba(255,255,255,0.98)' : 'transparent',
      backdropFilter: scrolled ? 'blur(10px)' : 'none',
      borderBottom: scrolled ? '1px solid rgba(16,185,129,0.1)' : 'none',
      transition: 'all 0.3s ease',
    },
    logoSection: {
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
    },
    logo: {
      border: scrolled ? '2px solid #10b981' : '3px solid rgba(187,247,208,0.3)',
      borderRadius: '50%',
      padding: '0.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'all 0.3s',
    },
    brandText: {
      display: 'flex',
      flexDirection: 'column',
    },
    title: {
      fontSize: '1.2rem',
      fontWeight: 400,
      color: scrolled ? '#059669' : '#fff',
      margin: 0,
      letterSpacing: '4px',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      transition: 'color 0.3s',
    },
    subtitle: {
      fontSize: '0.55rem',
      color: scrolled ? '#059669' : '#bbf7d0',
      margin: 0,
      fontWeight: 300,
      letterSpacing: '4px',
      textTransform: 'uppercase',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      transition: 'color 0.3s',
    },
    nav: {
      display: 'flex',
      gap: '2.5rem',
      alignItems: 'center',
    },
    navLink: {
      color: scrolled ? '#374151' : '#fff',
      fontSize: '0.7rem',
      fontWeight: 400,
      textDecoration: 'none',
      letterSpacing: '2px',
      textTransform: 'uppercase',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      padding: '0.75rem 1.25rem',
      borderRadius: '8px',
    },
    section: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      padding: '0 2rem',
    },
    heroContent: {
      textAlign: 'center',
      maxWidth: '900px',
      zIndex: 10,
    },
    heroLabel: {
      fontSize: '0.7rem',
      fontWeight: 300,
      color: '#bbf7d0',
      marginBottom: '1.5rem',
      letterSpacing: '3px',
      textTransform: 'uppercase',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    },
    heroText: {
      fontSize: '2.5rem',
      fontWeight: 300,
      color: '#fff',
      lineHeight: '1.5',
      marginBottom: '2.5rem',
      textTransform: 'uppercase',
      letterSpacing: '3px',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    },
    exploreBtn: {
      background: 'transparent',
      color: '#fff',
      border: '1px solid rgba(255,255,255,0.5)',
      borderRadius: '0',
      padding: '0.9rem 2.5rem',
      fontSize: '0.75rem',
      fontWeight: 400,
      cursor: 'pointer',
      letterSpacing: '3px',
      textTransform: 'uppercase',
      transition: 'all 0.3s',
      fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
      position: 'relative',
      overflow: 'hidden',
      animation: 'glow 2s ease-in-out infinite',
    },
    
    // ===== CENTERED SECTIONS =====
    centeredSection: {
      background: '#fff',
      minHeight: '100vh',
      padding: '8rem 2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
    },
    centeredContainer: {
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%',
      textAlign: 'center',
    },
    centeredLabel: {
      fontSize: '0.75rem',
      fontWeight: 600,
      color: '#10b981',
      letterSpacing: '3px',
      textTransform: 'uppercase',
      marginBottom: '1.5rem',
      display: 'inline-block',
      padding: '0.5rem 1.5rem',
      background: 'rgba(16, 185, 129, 0.08)',
      borderRadius: '50px',
    },
    centeredTitle: {
      fontSize: '3.5rem',
      fontWeight: 700,
      color: '#111',
      lineHeight: '1.15',
      marginBottom: '2rem',
      maxWidth: '1000px',
      marginLeft: 'auto',
      marginRight: 'auto',
      letterSpacing: '-0.03em',
    },
    centeredSubtitle: {
      fontSize: '1.2rem',
      color: '#6b7280',
      lineHeight: '1.8',
      fontWeight: 400,
      marginBottom: '4rem',
      maxWidth: '800px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    
    // Mission Impact Cards
    impactGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
      gap: '2rem',
      marginTop: '4rem',
    },
    impactCard: {
      background: 'rgba(255, 255, 255, 0.95)',
      backdropFilter: 'blur(10px)',
      borderRadius: '24px',
      padding: '0',
      boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
      border: '1px solid rgba(255,255,255,0.18)',
      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
      textAlign: 'left',
      position: 'relative',
      overflow: 'hidden',
    },
    impactCardImage: {
      width: '100%',
      height: '220px',
      objectFit: 'cover',
    },
    impactCardContent: {
      padding: '2rem',
    },
    impactIcon: {
      width: '52px',
      height: '52px',
      background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
      borderRadius: '12px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '1.5rem',
      boxShadow: '0 4px 16px rgba(16,185,129,0.25)',
    },
    impactTitle: {
      fontSize: '1.5rem',
      fontWeight: 700,
      color: '#111',
      marginBottom: '1rem',
      letterSpacing: '-0.02em',
      lineHeight: '1.3',
    },
    impactDesc: {
      fontSize: '1rem',
      color: '#6b7280',
      lineHeight: '1.7',
      fontWeight: 400,
    },
    
    // Technology Section
    technologySection: {
      background: 'linear-gradient(180deg, #f9fafb 0%, #fff 100%)',
      minHeight: '100vh',
      padding: '8rem 2rem',
      textAlign: 'center',
      position: 'relative',
    },
    techContainer: {
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%',
    },
    techRow: {
      display: 'flex',
      alignItems: 'center',
      gap: '4rem',
      marginBottom: '5rem',
      opacity: 0,
      animation: 'fadeInUp 0.8s ease-out forwards',
    },
    techImageContainer: {
      flex: '0 0 45%',
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '24px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    },
    techRowImage: {
      width: '100%',
      height: '400px',
      objectFit: 'cover',
      display: 'block',
      transition: 'transform 0.4s ease',
    },
    techContentContainer: {
      flex: '1',
      position: 'relative',
    },
    techBadge: {
      display: 'inline-block',
      background: 'rgba(16, 185, 129, 0.1)',
      color: '#10b981',
      fontSize: '0.85rem',
      fontWeight: 700,
      padding: '0.5rem 1rem',
      borderRadius: '50px',
      marginBottom: '1.5rem',
    },
    techIconLarge: {
      width: '64px',
      height: '64px',
      background: 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
      borderRadius: '16px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '1.5rem',
      boxShadow: '0 4px 20px rgba(16,185,129,0.25)',
    },
    techRowTitle: {
      fontSize: '2.5rem',
      fontWeight: 700,
      color: '#111',
      marginBottom: '1rem',
      letterSpacing: '-0.02em',
      lineHeight: '1.2',
    },
    techRowDesc: {
      fontSize: '1.1rem',
      color: '#6b7280',
      lineHeight: '1.7',
      marginBottom: '2rem',
    },
    techRowList: {
      listStyle: 'none',
      padding: 0,
      margin: 0,
      display: 'flex',
      flexWrap: 'wrap',
      gap: '1rem',
    },
    techRowListItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      fontSize: '0.95rem',
      color: '#374151',
      fontWeight: 500,
      background: '#f9fafb',
      padding: '0.6rem 1.2rem',
      borderRadius: '50px',
      border: '1px solid #e5e7eb',
    },
    checkIcon: {
      color: '#10b981',
      flexShrink: 0,
      marginTop: '0.2rem',
      width: '18px',
      height: '18px',
    },
    
    // Features Section
    featuresSection: {
      background: '#fff',
      minHeight: '100vh',
      padding: '8rem 2rem',
      textAlign: 'center',
      position: 'relative',
    },
    featuresContainer: {
      maxWidth: '1400px',
      margin: '0 auto',
      width: '100%',
    },
    featuresGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '2rem',
      marginTop: '4rem',
    },
    featureCard: {
      background: 'transparent',
      borderRadius: '0',
      padding: '2rem 1rem',
      boxShadow: 'none',
      border: 'none',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      textAlign: 'center',
      position: 'relative',
      overflow: 'visible',
      cursor: 'pointer', // ADD THIS
    },
    featureIconCircle: {
      width: '80px',
      height: '80px',
      background: 'rgba(16, 185, 129, 0.08)',
      borderRadius: '50%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 1.5rem',
      transition: 'all 0.3s ease',
      border: '2px solid transparent',
    },
    featureTitle: {
      fontSize: '1.1rem',
      fontWeight: 600,
      color: '#111',
      marginBottom: '0.75rem',
      letterSpacing: '-0.01em',
      lineHeight: '1.3',
    },
    featureDesc: {
      fontSize: '0.9rem',
      color: '#6b7280',
      lineHeight: '1.5',
      fontWeight: 400,
    },
    
    // ===== MODERN FOOTER =====
    footer: {
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: '#fff',
      padding: '4rem 3rem 2rem',
      borderTop: 'none',
    },
    footerContent: {
      maxWidth: '1200px',
      margin: '0 auto',
    },
    footerActions: {
      display: 'flex',
      gap: '1rem',
      justifyContent: 'center',
      marginBottom: '4rem',
      paddingBottom: '4rem',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
    },
    footerActionBtn: {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: '#fff',
      border: 'none',
      borderRadius: '50px',
      padding: '1rem 2rem',
      fontSize: '1rem',
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.3s ease',
      boxShadow: '0 4px 20px rgba(16,185,129,0.3)',
    },
    footerGrid: {
      display: 'grid',
      gridTemplateColumns: '1fr 2fr',
      gap: '4rem',
      marginBottom: '3rem',
      alignItems: 'start',
    },
    footerBrand: {
      textAlign: 'left',
    },
    footerLinksGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: '3rem',
      justifyContent: 'start',
    },
    linkColumn: {
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      textAlign: 'left',
    },
    linkTitle: {
      fontSize: '0.85rem',
      fontWeight: 700,
      color: 'rgba(255,255,255,0.9)',
      marginBottom: '0.75rem',
      letterSpacing: '1px',
      textTransform: 'uppercase',
    },
    footerLink: {
      color: 'rgba(255,255,255,0.6)',
      fontSize: '0.9rem',
      textDecoration: 'none',
      cursor: 'pointer',
      background: 'none',
      border: 'none',
      padding: '0.25rem 0',
      textAlign: 'left',
      transition: 'all 0.2s ease',
      fontWeight: 400,
    },
    footerBottom: {
      paddingTop: '2rem',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      textAlign: 'center',
    },
    footerText: {
      fontSize: '0.85rem',
      color: 'rgba(255,255,255,0.5)',
      fontWeight: 400,
    },
    cropOverlay: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(247, 251, 248, 0.92)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.75rem',
      zIndex: 2300,
      backdropFilter: 'blur(4px)',
    },
    cropClouds: {
      position: 'relative',
      width: '200px',
      height: '80px',
    },
    cropCloud: {
      position: 'absolute',
      borderRadius: '999px',
      border: '2px solid #f59e0b',
      background: 'transparent',
      animation: 'float 1.8s ease-in-out infinite',
    },
    cropDrops: {
      display: 'flex',
      gap: '12px',
      marginTop: '4px',
    },
    cropDrop: {
      width: '8px',
      height: '14px',
      background: '#cbd5e1',
      borderRadius: '999px',
      animation: 'cropDrop 0.9s ease-in-out infinite',
    },
    cropLabel: {
      color: '#14532d',
      fontWeight: 700,
      fontSize: '0.95rem',
    },
  };

  return (
    <div style={{ ...styles.page, opacity: loading ? 0 : 1, transition: 'opacity 0.6s cubic-bezier(.4,0,.2,1)' }}>
      <style>{`
        body {
          margin: 0;
          padding: 0;
          overflow-x: hidden;
          scroll-behavior: smooth;
        }
        ::-webkit-scrollbar {
          width: 6px;
        }
        ::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.05);
        }
        ::-webkit-scrollbar-thumb {
          background: linear-gradient(135deg, #10b981, #34d399);
          border-radius: 3px;
        }
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(40px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes slideInLeft {
          from {
            opacity: 0;
            transform: translateX(-40px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes cropDrop {
          0% { transform: translateY(-6px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(8px); opacity: 0; }
        }
        @keyframes glow {
          0%, 100% { box-shadow: 0 0 20px rgba(16,185,129,0.3); }
          50% { box-shadow: 0 0 30px rgba(16,185,129,0.6), 0 0 40px rgba(16,185,129,0.4); }
        }
        .fade-in {
          animation: fadeInUp 0.8s ease-out forwards;
          opacity: 0;
        }
        .slide-in {
          animation: slideInLeft 0.8s ease-out forwards;
          opacity: 0;
        }
        .card {
          opacity: 0;
          animation: fadeInUp 0.8s ease-out forwards;
        }
        .card:nth-child(2) { animation-delay: 0.1s; }
        .card:nth-child(3) { animation-delay: 0.2s; }
        .card:hover {
          transform: translateY(-12px);
          box-shadow: 0 24px 60px rgba(0,0,0,0.12);
        }
        .impactCard img {
          transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .impactCard:hover img {
          transform: scale(1.05);
        }
        .tech-row:hover .techRowImage {
          transform: scale(1.05);
        }
        .featureCard:hover .featureIconCircle {
          background: linear-gradient(135deg, #10b981 0%, #34d399 100%);
          border-color: #10b981;
          transform: scale(1.1);
        }
        .featureCard:hover .feature-icon {
          color: #fff !important;
        }
        .footerActionBtn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 28px rgba(16,185,129,0.4);
        }
        .navLink:hover {
          background: rgba(16,185,129,0.15) !important;
          color: #10b981 !important;
        }
        .exploreBtn:hover {
          background: rgba(255,255,255,0.1) !important;
          color: #fff !important;
          border-color: rgba(255,255,255,0.8);
          box-shadow: 0 4px 20px rgba(16,185,129,0.2);
          transform: translateY(-2px);
        }
        .ctaBtn:hover {
          transform: translateY(-3px);
          box-shadow: 0 8px 30px rgba(16,185,129,0.3);
          scale: 1.02;
        }
        .impactCard:hover, .featureCard:hover {
          transform: translateY(-8px);
        }
        .impactCard:hover {
          box-shadow: 0 20px 50px rgba(0,0,0,0.1);
          border-color: #10b981;
        }
        .impactCard::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 4px;
          background: linear-gradient(90deg, #10b981, #34d399);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .impactCard:hover::before {
          opacity: 1;
        }
        .footerLink:hover {
          color: #10b981 !important;
          transform: translateX(4px);
        }
        /* Hide scrollbar for all browsers */
        body::-webkit-scrollbar,
        html::-webkit-scrollbar,
        *::-webkit-scrollbar {
          display: none;
        }
        body, html {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        @media (max-width: 768px) {
          .centeredTitle { font-size: 2.5rem; }
          .ctaTitle { font-size: 2.5rem; }
          .ctaButtons { flex-direction: column; align-items: center; }
          .ctaBtn { min-width: auto; width: 100%; max-width: 300px; }
          .footerTop { flex-direction: column; gap: 2rem; }
          .footerLinks { gap: 2rem; }
          .impactCard, .featureCard { margin-bottom: 1rem; }
          .techRow { flex-direction: column !important; }
          .techImageContainer { flex: 1 1 100%; }
          .techRowImage { height: 300px; }
          .techRowTitle { font-size: 2rem; }
          .footerGrid { grid-template-columns: 1fr; gap: 2rem; }
          .footerLinksGrid { grid-template-columns: 1fr; }
          .footerActions { flex-direction: column; }
          .footerActionBtn { width: 100%; justify-content: center; }
        }
        @media (max-width: 480px) {
          .centeredTitle { font-size: 2rem; }
          .ctaTitle { font-size: 2rem; }
          .impactTitle, .techTitle, .featureTitle { font-size: 1.25rem; }
          .techRowTitle { font-size: 1.75rem; }
          .featuresGrid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
      
      {backgroundImages.map((img, index) => (
        <img
          key={index}
          src={img}
          alt="Background"
          style={{
            ...styles.bgImage,
            opacity: currentBg === index ? 1 : 0,
            pointerEvents: 'none',
          }}
          loading={index === 0 ? "eager" : "lazy"}
        />
      ))}

      <div style={styles.bgOverlay}></div>

      <header style={styles.header}>
        <div style={styles.logoSection}>
          <span style={styles.logo}><Leaf size={32} color={scrolled ? "#10b981" : "#bbf7d0"} /></span>
          <div style={styles.brandText}>
            <h1 style={styles.title}>FASALGUARD</h1>
            <div style={styles.subtitle}>Join The Green Revolution</div>
          </div>
        </div>
        <nav style={styles.nav}>
          <button style={styles.navLink} className="navLink" type="button" onClick={() => navigate('/about')}>About Us</button>
          <button style={styles.navLink} className="navLink" type="button" onClick={() => navigate('/services')}>Services</button>
          <button style={styles.navLink} className="navLink" type="button" onClick={() => navigate('/contact')}>Contact Us</button>
          <div style={{ position: 'relative', marginLeft: '1.5rem' }}>
            <span
              style={{ color: scrolled ? '#374151' : '#fff', fontSize: '1.5rem', cursor: 'pointer', transition: 'color 0.3s' }}
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
                  background: 'rgba(17, 24, 39, 0.98)',
                  color: '#fff',
                  borderRadius: '12px',
                  boxShadow: '0 10px 40px rgba(16,185,129,0.2)',
                  minWidth: '140px',
                  zIndex: 999,
                  padding: '0.5rem 0',
                  fontSize: '0.95rem',
                  border: '1px solid rgba(16,185,129,0.2)',
                  backdropFilter: 'blur(10px)',
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
                    fontSize: '0.95rem',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => { setShowDropdown(false); navigate('/profile'); }}
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
                    fontSize: '0.95rem',
                    transition: 'background 0.2s',
                  }}
                  onClick={() => {
                    setShowDropdown(false);
                    if (typeof onLogout === 'function') {
                      onLogout();
                    } else {
                      navigate('/login');
                    }
                  }}
                  onMouseDown={e => e.preventDefault()}
                >Logout</button>
              </div>
            )}
          </div>
        </nav>
      </header>

      <section style={styles.section}>
        <motion.div 
          style={styles.heroContent}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: "easeOut" }}
        >
          <motion.div 
            style={styles.heroLabel}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
          >
            Pakistani Proverb
          </motion.div>
          <motion.h2 
            style={styles.heroText}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
          >
            "Knowledge is like a garden; if it is not cultivated, it cannot be harvested."
          </motion.h2>
          <motion.button 
            style={styles.exploreBtn} 
            className="exploreBtn"
            onClick={handleStartPrediction}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8, duration: 0.5, type: "spring" }}
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(16,185,129,0.5)' }}
            whileTap={{ scale: 0.95 }}
          >
            🌱 Get Started
          </motion.button>
          
          {/* Scroll Indicator */}
          <motion.div
            style={{
              position: 'absolute',
              bottom: '2rem',
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              cursor: 'pointer',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, 10, 0] }}
            transition={{ 
              opacity: { delay: 1.2, duration: 0.8 },
              y: { repeat: Infinity, duration: 1.5, ease: "easeInOut" }
            }}
            onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
          >
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', letterSpacing: '2px' }}>SCROLL</span>
            <ChevronDown size={24} color="rgba(255,255,255,0.6)" />
          </motion.div>
        </motion.div>
      </section>

      {/* ===== MISSION SECTION (CENTERED) ===== */}
      <section style={styles.centeredSection}>
        <div style={styles.centeredContainer}>
          <motion.span 
            style={styles.centeredLabel}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            OUR MISSION
          </motion.span>
          <motion.h2 
            style={styles.centeredTitle}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Smart Farming for Pakistan's Future
          </motion.h2>
          <motion.p 
            style={styles.centeredSubtitle}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Transforming traditional farming with AI-powered insights and real-time data 
            to help farmers make better decisions and increase yields.
          </motion.p>
          
          <div style={styles.impactGrid}>
            {[
              { icon: Target, title: "Precision Farming", desc: "Hyper-local insights that enable precise resource allocation, reducing waste and maximizing yield per acre through data-driven agriculture.", img: farmImages.precision },
              { icon: Shield, title: "Risk Mitigation", desc: "Proactive climate risk assessment and early warning systems to protect crops from unpredictable weather patterns and environmental threats.", img: farmImages.mission },
              { icon: TrendingUp, title: "Yield Optimization", desc: "Advanced predictive models that increase crop yields by 30-40% through intelligent data analysis and actionable insights.", img: farmImages.features },
            ].map((item, index) => (
              <motion.div 
                key={index}
                className="card impactCard" 
                style={styles.impactCard}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: index * 0.2, duration: 0.6 }}
                whileHover={{ y: -10, boxShadow: '0 20px 50px rgba(16,185,129,0.15)' }}
              >
                <img 
                  src={item.img} 
                  alt={item.title} 
                  style={styles.impactCardImage}
                />
                <div style={styles.impactCardContent}>
                  <motion.div 
                    style={styles.impactIcon}
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <item.icon size={26} color="#fff" />
                  </motion.div>
                  <h3 style={styles.impactTitle}>{item.title}</h3>
                  <p style={styles.impactDesc}>{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TECHNOLOGY SECTION (SIDE-BY-SIDE) ===== */}
      <section style={styles.technologySection}>
        <div style={styles.techContainer}>
          <motion.span 
            style={styles.centeredLabel}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            OUR TECHNOLOGY
          </motion.span>
          <motion.h2 
            style={styles.centeredTitle}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Powered by AI & Satellites
          </motion.h2>
          <motion.p 
            style={styles.centeredSubtitle}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Three core technologies working together to revolutionize farming.
          </motion.p>
          
          {/* AI/ML Engine - Image Left */}
          <motion.div 
            className="tech-row" 
            style={styles.techRow}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <div style={styles.techImageContainer}>
              <img 
                src={farmImages.aitech} 
                alt="AI/ML Technology" 
                style={styles.techRowImage}
              />
            </div>
            <div style={styles.techContentContainer}>
              <motion.div 
                style={styles.techBadge}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                01
              </motion.div>
              <motion.div 
                style={styles.techIconLarge}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Cpu size={32} color="#fff" />
              </motion.div>
              <h3 style={styles.techRowTitle}>AI/ML Engine</h3>
              <p style={styles.techRowDesc}>
                Advanced neural networks analyze patterns and predict outcomes with unprecedented accuracy.
              </p>
              <ul style={styles.techRowList}>
                <li style={styles.techRowListItem}><CheckCircle size={16} style={styles.checkIcon} /> Time-series prediction</li>
                <li style={styles.techRowListItem}><CheckCircle size={16} style={styles.checkIcon} /> Multi-variable analysis</li>
                <li style={styles.techRowListItem}><CheckCircle size={16} style={styles.checkIcon} /> Image processing</li>
              </ul>
            </div>
          </motion.div>

          {/* Satellite Analytics - Image Right */}
          <motion.div 
            className="tech-row" 
            style={{...styles.techRow, flexDirection: 'row-reverse'}}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
          >
            <div style={styles.techImageContainer}>
              <img 
                src={farmImages.satellite} 
                alt="Satellite Analytics" 
                style={styles.techRowImage}
              />
            </div>
            <div style={styles.techContentContainer}>
              <motion.div 
                style={styles.techBadge}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
              >
                02
              </motion.div>
              <motion.div 
                style={styles.techIconLarge}
                whileHover={{ scale: 1.1, rotate: -5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Globe size={32} color="#fff" />
              </motion.div>
              <h3 style={styles.techRowTitle}>Satellite Analytics</h3>
              <p style={styles.techRowDesc}>
                Real-time satellite imagery provides comprehensive field-level insights from space.
              </p>
              <ul style={styles.techRowList}>
                <li style={styles.techRowListItem}><CheckCircle size={16} style={styles.checkIcon} /> Vegetation mapping</li>
                <li style={styles.techRowListItem}><CheckCircle size={16} style={styles.checkIcon} /> Soil moisture detection</li>
                <li style={styles.techRowListItem}><CheckCircle size={16} style={styles.checkIcon} /> Crop health monitoring</li>
              </ul>
            </div>
          </motion.div>

          {/* Data Integration - Image Left */}
          <motion.div 
            className="tech-row" 
            style={styles.techRow}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
          >
            <div style={styles.techImageContainer}>
              <img 
                src={farmImages.dataIntegration} 
                alt="Data Integration" 
                style={styles.techRowImage}
              />
            </div>
            <div style={styles.techContentContainer}>
              <motion.div 
                style={styles.techBadge}
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
              >
                03
              </motion.div>
              <motion.div 
                style={styles.techIconLarge}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Database size={32} color="#fff" />
              </motion.div>
              <h3 style={styles.techRowTitle}>Data Integration</h3>
              <p style={styles.techRowDesc}>
                Seamlessly combines weather data, soil sensors, and government databases.
              </p>
              <ul style={styles.techRowList}>
                <li style={styles.techRowListItem}><CheckCircle size={16} style={styles.checkIcon} /> Real-time weather</li>
                <li style={styles.techRowListItem}><CheckCircle size={16} style={styles.checkIcon} /> Climate patterns</li>
                <li style={styles.techRowListItem}><CheckCircle size={16} style={styles.checkIcon} /> Agricultural data</li>
              </ul>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== FEATURES SECTION (ICON GRID) ===== */}
      <section style={styles.featuresSection}>
        <div style={styles.featuresContainer}>
          <motion.span 
            style={styles.centeredLabel}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            KEY FEATURES
          </motion.span>
          <motion.h2 
            style={styles.centeredTitle}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            Everything Farmers Need
          </motion.h2>
          <motion.p 
            style={styles.centeredSubtitle}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4, duration: 0.8 }}
          >
            Simple tools that make farming smarter and more profitable.
          </motion.p>
          
          <div style={styles.featuresGrid}>
            {[
              { 
                icon: BarChart, 
                title: "Yield Prediction", 
                desc: "Perfect yield insights before sowing",
                onClick: () => navigate('/crop-prediction')
              },
              { 
                icon: Map, 
                title: "Field Mapping", 
                desc: "Map fields and detect hotspots",
                onClick: () => navigate('/satellite-analysis')
              },
              { 
                icon: Sun, 
                title: "Soil Analysis", 
                desc: "Soil score, pH, and nutrients",
                onClick: () => navigate('/soil-analysis')
              },
              { 
                icon: AlertCircle, 
                title: "Satellite Field Analysis & Alert", 
                desc: "Field health maps with smart alerts",
                onClick: () => navigate('/satellite-analysis')
              },
              { 
                icon: CloudRain, 
                title: "Weather Forecast", 
                desc: "Forecasts to plan your crop",
                onClick: () => navigate('/crop-prediction')
              },
            ].map((item, index) => (
              <motion.div 
                key={index}
                className="card featureCard" 
                style={styles.featureCard}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: index * 0.1, duration: 0.5, type: "spring" }}
                onClick={item.onClick} // ADDED
              >
                <motion.div 
                  style={styles.featureIconCircle}
                  whileHover={{ 
                    scale: 1.1, 
                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                    boxShadow: '0 10px 30px rgba(16,185,129,0.4)'
                  }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                  >
                    <item.icon size={36} style={{ color: '#10b981', transition: 'color 0.3s' }} className="feature-icon" />
                  </motion.div>
                </motion.div>
                <h3 style={styles.featureTitle}>{item.title}</h3>
                <p style={styles.featureDesc}>{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== MODERN FOOTER ===== */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          {/* Quick Action Buttons */}
          <motion.div 
            style={styles.footerActions}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
          >
            <motion.button 
              style={styles.footerActionBtn}
              onClick={handleStartPrediction}
              whileHover={{ scale: 1.05, boxShadow: '0 8px 32px rgba(16,185,129,0.5)' }}
              whileTap={{ scale: 0.95 }}
            >
              <Zap size={20} />
              Start Predicting
            </motion.button>
            <motion.button 
              style={{...styles.footerActionBtn, background: 'transparent', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981'}}
              onClick={() => navigate('/contact')}
              whileHover={{ scale: 1.05, borderColor: '#10b981' }}
              whileTap={{ scale: 0.95 }}
            >
              <Users size={20} />
              Contact Us
            </motion.button>
          </motion.div>

          {/* Footer Links */}
          <motion.div 
            style={styles.footerGrid}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <div style={styles.footerBrand}>
              <motion.div 
                style={{display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem'}}
                whileHover={{ scale: 1.05 }}
              >
                <Leaf size={28} color="#10b981" />
                <span style={{fontSize: '1.3rem', fontWeight: 700, color: '#fff'}}>FasalGuard</span>
              </motion.div>
              <p style={{color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', lineHeight: '1.6', maxWidth: '300px'}}>
                Smart farming solutions for Pakistan's agricultural future.
              </p>
            </div>
            
            <div style={styles.footerLinksGrid}>
              <div style={styles.linkColumn}>
                <div style={styles.linkTitle}>Features</div>
                <motion.button 
                  style={styles.footerLink} 
                  onClick={handleStartPrediction}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Yield Prediction
                </motion.button>
                <motion.button 
                  style={styles.footerLink} 
                  onClick={() => navigate('/satellite-analysis')}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Field Mapping
                </motion.button>
                <motion.button 
                  style={styles.footerLink} 
                  onClick={() => navigate('/soil-analysis')}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Soil Analysis
                </motion.button>
                <motion.button 
                  style={styles.footerLink}
                  onClick={() => navigate('/satellite-analysis')}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Satellite Field Analysis & Alert
                </motion.button>
                <motion.button 
                  style={styles.footerLink}
                  onClick={() => navigate('/crop-prediction')}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Weather Forecast
                </motion.button>
                <motion.button 
                  style={styles.footerLink} 
                  onClick={() => navigate('/past-trends')}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Past Trends
                </motion.button>
              </div>
              
              <div style={styles.linkColumn}>
                <div style={styles.linkTitle}>Company</div>
                <motion.button 
                  style={styles.footerLink} 
                  onClick={() => navigate('/about')}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  About
                </motion.button>
                <motion.button 
                  style={styles.footerLink} 
                  onClick={() => navigate('/contact')}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Contact
                </motion.button>
                <motion.button 
                  style={styles.footerLink}
                  onClick={() => navigate('/services')}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Services
                </motion.button>
                <motion.button
                  style={styles.footerLink}
                  onClick={() => window.dispatchEvent(new Event('open-help-chat'))}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Help
                </motion.button>
              </div>
              
              <div style={styles.linkColumn}>
                <div style={styles.linkTitle}>Legal</div>
                <motion.button 
                  style={styles.footerLink}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Privacy
                </motion.button>
                <motion.button 
                  style={styles.footerLink}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Terms
                </motion.button>
                <motion.button 
                  style={styles.footerLink}
                  whileHover={{ x: 5, color: '#10b981' }}
                >
                  Cookies
                </motion.button>
              </div>
            </div>
          </motion.div>
          
          <div style={styles.footerBottom}>
            <div style={styles.footerText}>
              © 2025 FasalGuard. Empowering Pakistani farmers with technology.
            </div>
          </div>
        </div>
      </footer>

      {cropNavLoading && (
        <div style={styles.cropOverlay}>
          <div style={styles.cropClouds}>
            <span style={{ ...styles.cropCloud, width: '120px', height: '44px', left: 0, top: '18px' }}></span>
            <span style={{ ...styles.cropCloud, width: '90px', height: '34px', right: 0, top: 0, animationDelay: '0.2s' }}></span>
            <span style={{ ...styles.cropCloud, width: '32px', height: '32px', right: '18px', top: '10px', animationDelay: '0.35s' }}></span>
          </div>
          <div style={styles.cropDrops}>
            <span style={{ ...styles.cropDrop, animationDelay: '0s' }}></span>
            <span style={{ ...styles.cropDrop, animationDelay: '0.2s' }}></span>
            <span style={{ ...styles.cropDrop, animationDelay: '0.4s' }}></span>
          </div>
          <div style={styles.cropLabel}>Preparing crop forecast...</div>
        </div>
      )}
    </div>
  );
}