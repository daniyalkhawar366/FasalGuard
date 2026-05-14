import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Play, StopCircle, Globe, Gauge, HelpCircle, MessageCircle } from 'lucide-react';
import { useLanguage } from './context/LanguageContext';

const API_MODULE_ACTIONS = [
  { key: 'home', label: { en: 'Home', ur: 'ہوم', hi: 'होम' }, path: '/home', keywords: ['home', 'dashboard', 'main menu'] },
  { key: 'weather', label: { en: 'Climate Prediction', ur: 'موسمی پیشگوئی', hi: 'मौसम पूर्वानुमान' }, path: '/prediction-results/weather', keywords: ['weather', 'climate', 'forecast', 'mosam', 'mausam', 'climate prediction'] },
  { key: 'soil', label: { en: 'Soil Analysis', ur: 'مٹی کا تجزیہ', hi: 'मिट्टी विश्लेषण' }, path: '/soil-analysis', keywords: ['soil', 'zameen', 'zameen ka', 'soil analysis'] },
  { key: 'satellite', label: { en: 'Satellite & Field Analysis', ur: 'سیٹلائٹ اور فیلڈ تجزیہ', hi: 'सैटेलाइट और खेत विश्लेषण' }, path: '/satellite-analysis', keywords: ['satellite', 'field', 'map', 'satellite analysis'] },
  { key: 'crop', label: { en: 'Crop Prediction', ur: 'فصل پیشگوئی', hi: 'फसल पूर्वानुमान' }, path: '/crop-prediction', keywords: ['crop', 'prediction', 'recommendation', 'crop prediction'] },
  { key: 'irrigation', label: { en: 'Smart Irrigation', ur: 'سمارٹ آبپاشی', hi: 'स्मार्ट सिंचाई' }, path: '/prediction-results/irrigation', keywords: ['irrigation', 'pani', 'water schedule'] },
  { key: 'matrix', label: { en: 'Crop Matrix', ur: 'کراپ میٹرکس', hi: 'क्रॉप मैट्रिक्स' }, path: '/prediction-results/matrix', keywords: ['matrix', 'comparison', 'compare crops'] },
  { key: 'report', label: { en: 'Generate Report', ur: 'رپورٹ بنائیں', hi: 'रिपोर्ट बनाएं' }, path: '/prediction-results/report', keywords: ['report', 'pdf', 'download'] },
  { key: 'trends', label: { en: 'Past Trends', ur: 'گزشتہ رجحانات', hi: 'पिछले रुझान' }, path: '/past-trends', keywords: ['past trends', 'history', 'trends'] },
  { key: 'services', label: { en: 'Services', ur: 'سروسز', hi: 'सेवाएं' }, path: '/services', keywords: ['services', 'service'] },
  { key: 'contact', label: { en: 'Contact', ur: 'رابطہ', hi: 'संपर्क' }, path: '/contact', keywords: ['contact', 'help desk'] },
];

const DEFAULT_SUGGESTIONS = [
  { en: 'How do I use this app?', ur: 'میں یہ ایپ کیسے استعمال کروں؟', hi: 'मैं यह ऐप कैसे उपयोग करूँ?' },
  { en: 'Explain soil analysis', ur: 'مٹی کا تجزیہ سمجھائیں', hi: 'मिट्टी विश्लेषण समझाइए' },
  { en: 'How climate prediction module works?', ur: 'موسمی پیشگوئی کہاں ہے؟', hi: 'मौसम पूर्वानुमान मॉड्यूल कैसे काम करता है?' },
  { en: 'How to use satellite analysis?', ur: 'سیٹلائٹ تجزیہ کیسے استعمال کریں؟', hi: 'सैटेलाइट विश्लेषण कैसे उपयोग करें?' },
];

const EXTRA_SUGGESTIONS = [
  { en: 'How do I check past yields?', ur: 'ماضی کی پیداوار کیسے دیکھیں؟', hi: 'मैं पिछली पैदावार कैसे देखूं?' },
  { en: 'Explain crop prediction results.', ur: 'کراپ پریڈکشن کے نتائج سمجھائیں۔', hi: 'फसल पूर्वानुमान के परिणाम समझाइए।' },
  { en: 'How does smart irrigation work?', ur: 'سمارٹ آبپاشی کیسے کام کرتی ہے؟', hi: 'स्मार्ट सिंचाई कैसे काम करती है?' },
  { en: 'What is the crop comparison matrix?', ur: 'کراپ کمپیریزن میٹرکس کیا ہے؟', hi: 'क्रॉप तुलना मैट्रिक्स क्या है?' },
  { en: 'How do I generate a report?', ur: 'رپورٹ کیسے بنائیں؟', hi: 'मैं रिपोर्ट कैसे बनाऊं?' },
  { en: 'How to read the soil score?', ur: 'سوائل اسکور کیسے پڑھیں؟', hi: 'मिट्टी स्कोर कैसे पढ़ें?' },
  { en: 'What is field heatmap?', ur: 'فیلڈ ہیٹ میپ کیا ہے؟', hi: 'फील्ड हीटमैप क्या है?' },
  { en: 'Where can I see past trends?', ur: 'گزشتہ رجحانات کہاں دیکھیں؟', hi: 'मैं पिछले रुझान कहां देखूं?' },
];

const API_BASE = process.env.REACT_APP_BACKEND_URL || 'https://fasalguard-production.up.railway.app';

const LANG_OPTIONS = [
  { id: 'en-US', label: 'English' },
  { id: 'hi-IN', label: 'Hindi' },
  { id: 'ur-PK', label: 'Urdu' },
];

const SPEED_OPTIONS = [0.8, 1.0, 1.2];

const normalizeText = (value) => String(value || '').toLowerCase();

const buildHowToUseResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- مرحلہ 1: ایپ کھولیں اور لاگ ان یا رجسٹر کریں۔\n- مرحلہ 2: مرکزی مینو سے فیچر منتخب کریں۔\n- مرحلہ 3: گزشتہ پیداوار اور فصل پیشگوئی کے لئے Crop Prediction page کھولیں۔\n- مرحلہ 4: مٹی کے تجزیے کے لئے Soil Analysis page کھولیں۔\n- مرحلہ 5: ہیٹ میپس اور ریئل ٹائم فیلڈ تجزیے کے لئے Satellite Analysis page کھولیں۔';
  }
  if (lang === 'hi-IN') {
    return '- चरण 1: ऐप खोलें और लॉगिन या रजिस्टर करें।\n- चरण 2: मुख्य मेन्यू से एक फीचर चुनें।\n- चरण 3: पिछली पैदावार और फसल पूर्वानुमान के लिए Crop Prediction पेज खोलें।\n- चरण 4: मिट्टी विश्लेषण के लिए Soil Analysis पेज खोलें।\n- चरण 5: हीटमैप और रियल-टाइम खेत विश्लेषण के लिए Satellite Analysis पेज खोलें।';
  }
  return '- Step 1: Open the app and log in or register.\n- Step 2: Use the main menu to choose a feature.\n- Step 3: For past yields and crop prediction, open the Crop Prediction page.\n- Step 4: For soil analysis, open the Soil Analysis page.\n- Step 5: For heatmaps and real-time field analysis, open the Satellite Analysis page.';
};

const buildSoilAnalysisResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Soil Analysis page کھولیں۔\n- اپنا شہر منتخب کریں اور جس فصل کا تجزیہ کرنا ہے وہ درج کریں۔\n- نتیجے میں soil score، pH اور دوسرے اہم indicators نظر آئیں گے۔\n- مکمل تفصیل کے لئے اسی page پر breakdown دیکھیں۔';
  }
  if (lang === 'hi-IN') {
    return '- Soil Analysis पेज खोलें।\n- अपना शहर चुनें और जिस फसल का विश्लेषण करना है उसे दर्ज करें।\n- परिणाम में soil score, pH और अन्य मुख्य संकेतक दिखते हैं।\n- पूरी जानकारी के लिए उसी पेज पर breakdown देखें।';
  }
  return '- Open the Soil Analysis page.\n- Select your city and enter the crop you want to analyze.\n- The result shows soil score, pH, and other key indicators.\n- For full details, review the breakdown on the same page.';
};

const buildClimatePredictionResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Climate Prediction module ریئل ٹائم موسم کی پیشگوئی دیتا ہے۔\n- یہ آنے والے حالات کے مطابق موزوں فصل تجویز کرتا ہے۔\n- اس میں smart irrigation calculations اور تفصیلی weather dashboard بھی شامل ہے۔\n- آپ crop comparison matrix سے فصلوں کا موازنہ کر سکتے ہیں۔\n- اس module کے لئے Crop Prediction page کھولیں۔';
  }
  if (lang === 'hi-IN') {
    return '- Climate Prediction मॉड्यूल real-time मौसम पूर्वानुमान देता है।\n- यह आने वाली परिस्थितियों के आधार पर उपयुक्त फसल सुझाता है।\n- इसमें smart irrigation calculations और detailed weather dashboard भी शामिल है।\n- आप crop comparison matrix से फसलों की तुलना कर सकते हैं।\n- इस मॉड्यूल के लिए Crop Prediction पेज खोलें।';
  }
  return '- The Climate Prediction module provides real-time weather forecasts.\n- It suggests suitable crops based on upcoming conditions.\n- It also includes smart irrigation calculations and a detailed weather dashboard.\n- You can compare crops using the crop comparison matrix.\n- Open the Crop Prediction page to access this module.';
};

const buildSatelliteAnalysisResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Satellite Analysis page کھولیں۔\n- فصل اور شہر منتخب کریں۔\n- اپنے coordinates درج کریں۔\n- نقشے پر اپنا field highlight کریں۔\n- پھر آپ کو field results مل جائیں گے۔';
  }
  if (lang === 'hi-IN') {
    return '- Satellite Analysis पेज खोलें।\n- फसल और शहर चुनें।\n- अपने coordinates दर्ज करें।\n- मैप पर अपना खेत highlight करें।\n- इसके बाद आपको खेत के परिणाम मिलेंगे।';
  }
  return '- Open the Satellite Analysis page.\n- Select crop and city.\n- Enter your coordinates.\n- Highlight your field on the map.\n- Then you will get the field results.';
};

const buildPastYieldsResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Past Trends page کھولیں۔\n- اپنی crop یا time range منتخب کریں۔\n- وہاں past yields اور historical trends دیکھ سکتے ہیں۔';
  }
  if (lang === 'hi-IN') {
    return '- Past Trends पेज खोलें।\n- अपनी फसल या समय सीमा चुनें।\n- वहां आप पिछली पैदावार और historical trends देख सकते हैं।';
  }
  return '- Open the Past Trends page.\n- Choose crop or time range.\n- You will see past yields and historical trends there.';
};

const buildCropPredictionResultsResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Crop Prediction چلائیں۔\n- Prediction Results page پر recommended crops اور details ملتی ہیں۔\n- وہاں سے آپ detail sections کھول سکتے ہیں۔';
  }
  if (lang === 'hi-IN') {
    return '- Crop Prediction चलाएं।\n- Prediction Results पेज पर recommended crops और details मिलती हैं।\n- वहां से आप detail sections खोल सकते हैं।';
  }
  return '- Run Crop Prediction.\n- On the Prediction Results page you get recommended crops and details.\n- Open the detail sections from there.';
};

const buildIrrigationResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Smart Irrigation page کھولیں۔\n- شہر اور crop منتخب کریں۔\n- system آپ کو irrigation schedule تجویز کرے گا۔';
  }
  if (lang === 'hi-IN') {
    return '- Smart Irrigation पेज खोलें।\n- शहर और फसल चुनें।\n- system आपको irrigation schedule सुझाएगा।';
  }
  return '- Open the Smart Irrigation page.\n- Select city and crop.\n- The system suggests an irrigation schedule.';
};

const buildMatrixResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Crop Matrix page کھولیں۔\n- متعدد crops کا موازنہ کریں۔\n- وہاں side-by-side comparative insights ملتی ہیں۔';
  }
  if (lang === 'hi-IN') {
    return '- Crop Matrix पेज खोलें।\n- कई फसलों की तुलना करें।\n- वहां side-by-side comparative insights मिलती हैं।';
  }
  return '- Open the Crop Matrix page.\n- Compare multiple crops.\n- You will see side-by-side insights.';
};

const buildReportResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Report Generator page کھولیں۔\n- درکار details منتخب کریں۔\n- report generate کریں اور download کر لیں۔';
  }
  if (lang === 'hi-IN') {
    return '- Report Generator पेज खोलें।\n- जरूरी details चुनें।\n- report generate करें और download करें।';
  }
  return '- Open the Report Generator page.\n- Select the required details.\n- Generate and download the report.';
};

const buildSoilScoreResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Soil Analysis page پر soil score نظر آتا ہے۔\n- اس کے ساتھ pH اور nutrient indicators بھی دکھتے ہیں۔\n- زیادہ score بہتر soil health کو ظاہر کرتا ہے۔';
  }
  if (lang === 'hi-IN') {
    return '- Soil Analysis पेज पर soil score दिखता है।\n- इसके साथ pH और nutrient indicators भी दिखते हैं।\n- ज्यादा score बेहतर soil health दिखाता है।';
  }
  return '- On the Soil Analysis page you will see the soil score.\n- It is shown with pH and nutrient indicators.\n- Higher score means better soil health.';
};

const buildFieldHeatmapResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Satellite Analysis میں heatmap field condition دکھاتا ہے۔\n- رنگ stress اور variation ظاہر کرتے ہیں۔\n- نقشے پر area منتخب کر کے details دیکھیں۔';
  }
  if (lang === 'hi-IN') {
    return '- Satellite Analysis में heatmap field condition दिखाता है।\n- रंग stress और variation बताते हैं।\n- मैप पर area चुनकर details देखें।';
  }
  return '- In Satellite Analysis, the heatmap shows field condition.\n- Colors indicate stress and variation.\n- Select the area on the map to see details.';
};

const buildPastTrendsResponse = (lang) => {
  if (lang === 'ur-PK') {
    return '- Past Trends page historical data اور trends دکھاتا ہے۔\n- crop اور time range منتخب کر کے insights دیکھیں۔';
  }
  if (lang === 'hi-IN') {
    return '- Past Trends पेज historical data और trends दिखाता है।\n- crop और time range चुनकर insights देखें।';
  }
  return '- The Past Trends page shows historical data and trends.\n- Choose crop and time range to view insights.';
};

const buildHelpResponse = (lang) => {
  if (lang === 'ur-PK') {
    return 'FasalGuard میں آپ Crop Prediction، Soil Analysis، Satellite Field Analysis اور Climate Forecast استعمال کر سکتے ہیں۔ Crop guidance کے لئے Crop Prediction استعمال کریں، climate کے لئے Weather Visualizations، soil reports کے لئے Soil Analysis، اور field stress کے لئے Satellite module استعمال کریں۔ میں آپ کو درست page تک رہنمائی دے سکتا ہوں۔';
  }
  if (lang === 'hi-IN') {
    return 'FasalGuard में आप Crop Prediction, Soil Analysis, Satellite Field Analysis और Climate Forecast उपयोग कर सकते हैं। crop guidance के लिए Crop Prediction, climate के लिए Weather Visualizations, soil reports के लिए Soil Analysis और field stress के लिए Satellite module उपयोग करें। मैं आपको सही पेज तक guide कर सकता हूँ।';
  }
  return 'In FasalGuard you can use Crop Prediction, Soil Analysis, Satellite Field Analysis, and Climate Forecast. Use Crop Prediction for crop guidance, Weather Visualizations for climate, Soil Analysis for soil reports, and Satellite for field stress. I can guide you to the right page.';
};

const buildIrrelevantResponse = (lang) => {
  if (lang === 'ur-PK') {
    return 'یہ سوال app features سے match نہیں کرتا۔ آپ crop prediction، soil analysis، climate prediction یا satellite analysis کے بارے میں پوچھ سکتے ہیں۔ نیچے سے کوئی feature منتخب کریں۔';
  }
  if (lang === 'hi-IN') {
    return 'यह सवाल app features से match नहीं करता। आप crop prediction, soil analysis, climate prediction या satellite analysis के बारे में पूछ सकते हैं। नीचे से कोई feature चुनें।';
  }
  return 'That question does not match app features. You can ask about crop prediction, soil analysis, climate prediction, or satellite analysis. Pick a feature below.';
};

const buildModuleResponse = (lang, moduleLabels) => {
  if (!moduleLabels.length) return '';
  if (lang === 'ur-PK') {
    return `Aap ne ${moduleLabels.join(', ')} ke bare mein poocha. Main aap ko is module ka short summary aur sahi page par le ja sakta hoon.`;
  }
  if (lang === 'hi-IN') {
    return `आपने ${moduleLabels.join(', ')} के बारे में पूछा है। मैं इस मॉड्यूल का छोटा सार और सही पेज पर मार्गदर्शन दे सकता हूँ।`;
  }
  return `You asked about ${moduleLabels.join(', ')}. I can summarize that module and take you to the right page.`;
};

export default function VoiceChat() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [selectedLang, setSelectedLang] = useState(language === 'ur' ? 'ur-PK' : 'en-US');
  const [speed, setSpeed] = useState(1.0);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [actions, setActions] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [cropLoading, setCropLoading] = useState(false);
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const playerRef = useRef(null);

  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const canRecordAudio = typeof window !== 'undefined' && !!(navigator?.mediaDevices?.getUserMedia && window.MediaRecorder);
  const SpeechRecognition = typeof window !== 'undefined'
    ? (window.SpeechRecognition || window.webkitSpeechRecognition)
    : null;

  const uiLang = selectedLang.startsWith('ur') ? 'ur' : (selectedLang.startsWith('hi') ? 'hi' : 'en');
  const lz = (en, ur, hi) => (uiLang === 'ur' ? ur : (uiLang === 'hi' ? hi : en));

  const normalizeElevenLanguage = (lang) => {
    const normalized = String(lang || '').toLowerCase();
    if (normalized.startsWith('hi')) return 'hi-IN';
    if (normalized.startsWith('ur')) return 'ur-PK';
    return 'en-US';
  };

  const stopSpeak = () => {
    if (canSpeak) window.speechSynthesis.cancel();
    if (playerRef.current) {
      playerRef.current.pause();
      if (playerRef.current.src) {
        URL.revokeObjectURL(playerRef.current.src);
      }
      playerRef.current = null;
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setPageLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (canSpeak) {
        window.speechSynthesis.cancel();
      }
    };
  }, [canSpeak]);

  const speak = (text) => {
    if (!text) return;
    stopSpeak();

    const playBrowserFallback = () => {
      if (!canSpeak) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = selectedLang;
      utterance.rate = speed;
      window.speechSynthesis.speak(utterance);
    };

    fetch(`${API_BASE}/api/voice/synthesize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text,
        language: selectedLang,
      }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('ElevenLabs TTS failed');
        }
        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        playerRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          if (playerRef.current === audio) {
            playerRef.current = null;
          }
        };
        audio.play().catch(() => {
          URL.revokeObjectURL(audioUrl);
          if (playerRef.current === audio) {
            playerRef.current = null;
          }
          playBrowserFallback();
        });
      })
      .catch(() => {
        playBrowserFallback();
      });
  };

  const buildAnswer = (query) => {
    const text = normalizeText(query);
    const matched = API_MODULE_ACTIONS.filter((item) =>
      item.keywords.some((keyword) => text.includes(keyword))
    );

    const wantsHowTo = text.includes('how') || text.includes('use') || text.includes('guide') || text.includes('kaise') || text.includes('step by step') || text.includes('steps');
    const wantsSoil = text.includes('soil analysis') || (text.includes('soil') && text.includes('analysis')) || text.includes('zameen');
    const wantsClimate = text.includes('climate prediction') || text.includes('weather prediction') || text.includes('climate module') || text.includes('weather forecast');
    const wantsSatellite = text.includes('satellite') || text.includes('heatmap') || text.includes('heatmaps') || text.includes('field analysis');
    const wantsPastYields = text.includes('past yields') || (text.includes('past') && text.includes('yield'));
    const wantsCropResults = text.includes('crop prediction results') || (text.includes('crop') && text.includes('results'));
    const wantsIrrigation = text.includes('irrigation') || text.includes('water schedule');
    const wantsMatrix = text.includes('matrix') || text.includes('comparison matrix') || text.includes('compare crops');
    const wantsReport = text.includes('report') || text.includes('generate report');
    const wantsSoilScore = text.includes('soil score') || (text.includes('score') && text.includes('soil'));
    const wantsHeatmap = text.includes('heatmap') || text.includes('field heatmap');
    const wantsPastTrends = text.includes('past trends') || (text.includes('history') && text.includes('trends'));

    const moduleLabels = matched.map((item) => (uiLang === 'ur' ? item.label.ur : (uiLang === 'hi' ? item.label.hi : item.label.en)));
    const moduleResponse = buildModuleResponse(selectedLang, moduleLabels);
    const helpResponse = buildHelpResponse(selectedLang);

    let finalResponse = '';
    let finalActions = matched;
    if (wantsPastYields) {
      finalResponse = buildPastYieldsResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'trends');
    } else if (wantsCropResults) {
      finalResponse = buildCropPredictionResultsResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'crop');
    } else if (wantsIrrigation) {
      finalResponse = buildIrrigationResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'irrigation');
    } else if (wantsMatrix) {
      finalResponse = buildMatrixResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'matrix');
    } else if (wantsReport) {
      finalResponse = buildReportResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'report');
    } else if (wantsSoilScore) {
      finalResponse = buildSoilScoreResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'soil');
    } else if (wantsHeatmap) {
      finalResponse = buildFieldHeatmapResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'satellite');
    } else if (wantsPastTrends) {
      finalResponse = buildPastTrendsResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'trends');
    } else if (wantsSatellite) {
      finalResponse = buildSatelliteAnalysisResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'satellite');
    } else if (wantsSoil) {
      finalResponse = buildSoilAnalysisResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'soil');
    } else if (wantsClimate) {
      finalResponse = buildClimatePredictionResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) => item.key === 'crop');
    } else if (wantsHowTo) {
      finalResponse = buildHowToUseResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) =>
        ['home', 'crop', 'soil', 'satellite'].includes(item.key)
      );
    } else if (moduleResponse) {
      finalResponse = `${moduleResponse} ${helpResponse}`;
    } else {
      finalResponse = buildIrrelevantResponse(selectedLang);
      finalActions = API_MODULE_ACTIONS.filter((item) =>
        ['crop', 'soil', 'satellite'].includes(item.key)
      );
    }

    return {
      response: finalResponse,
      actions: finalActions,
    };
  };

  const handleAsk = (query) => {
    if (!query) return;
    const { response: answer, actions: nextActions } = buildAnswer(query);
    setResponse(answer);
    setActions(nextActions);
    speak(answer);
  };

  const transcribeWithElevenLabs = async (blob, languageCode) => {
    const formData = new FormData();
    formData.append('audio', blob, 'voice.webm');
    formData.append('language', languageCode);

    const response = await fetch(`${API_BASE}/api/voice/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const failed = await response.json().catch(() => ({}));
      throw new Error(failed?.error || failed?.message || 'Transcription failed');
    }

    const payload = await response.json();
    return String(payload?.text || '').trim();
  };

  const startSpeechRecognitionFallback = () => {
    if (!SpeechRecognition) return;
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    const recognition = new SpeechRecognition();
    recognition.lang = selectedLang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalText += result[0].transcript;
        } else {
          interimText += result[0].transcript;
        }
      }
      const combined = `${finalText} ${interimText}`.trim();
      setTranscript(combined);
      if (finalText.trim()) {
        handleAsk(finalText.trim());
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  const handleStartListening = async () => {
    if (listening) return;
    setTranscript('');

    if (canRecordAudio) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? { mimeType: 'audio/webm;codecs=opus' }
          : undefined;

        const recorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        recorder.onstop = async () => {
          try {
            const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            const text = await transcribeWithElevenLabs(audioBlob, normalizeElevenLanguage(selectedLang));
            if (text) {
              setTranscript(text);
              handleAsk(text);
            }
          } catch (_error) {
            startSpeechRecognitionFallback();
            return;
          } finally {
            if (mediaStreamRef.current) {
              mediaStreamRef.current.getTracks().forEach((track) => track.stop());
              mediaStreamRef.current = null;
            }
            mediaRecorderRef.current = null;
            audioChunksRef.current = [];
            setListening(false);
          }
        };

        recorder.start();
        setListening(true);
        return;
      } catch (_error) {
        // Fall back to browser SpeechRecognition.
      }
    }

    if (!SpeechRecognition) return;
    startSpeechRecognitionFallback();
  };

  const handleStopListening = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setListening(false);
  };

  const handleActionClick = (action) => {
    if (action.key === 'crop') {
      setCropLoading(true);
      setTimeout(() => {
        setCropLoading(false);
        navigate(action.path);
      }, 800);
      return;
    }
    navigate(action.path);
  };

  const styles = useMemo(() => ({
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f7fbf8 0%, #eef6f0 100%)',
      color: '#0f172a',
      padding: '2rem 1.5rem',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '2rem',
      position: 'relative',
    },
    title: {
      fontSize: '2.1rem',
      fontWeight: 800,
      color: '#0f172a',
      display: 'flex',
      gap: '0.75rem',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 35%, #0ea5e9 70%, #6366f1 100%)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    card: {
      background: '#ffffff',
      borderRadius: '18px',
      padding: '1.5rem',
      boxShadow: '0 14px 30px rgba(15, 23, 42, 0.08)',
      border: '1px solid rgba(34, 197, 94, 0.2)',
      animation: 'vcFadeLift 0.45s ease both',
    },
    controls: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.75rem',
      alignItems: 'center',
      marginTop: '1rem',
    },
    button: {
      background: '#22c55e',
      color: '#fff',
      border: 'none',
      padding: '0.7rem 1.2rem',
      borderRadius: '12px',
      cursor: 'pointer',
      fontWeight: 600,
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.4rem',
    },
    ghost: {
      background: '#eef6f0',
      color: '#14532d',
      border: '1px solid rgba(34, 197, 94, 0.3)',
    },
    input: {
      width: '100%',
      padding: '0.8rem 1rem',
      borderRadius: '12px',
      border: '1px solid rgba(148, 163, 184, 0.4)',
      fontSize: '1rem',
      marginTop: '1rem',
    },
    response: {
      marginTop: '1rem',
      padding: '1rem',
      borderRadius: '14px',
      background: 'rgba(34, 197, 94, 0.12)',
      border: '1px solid rgba(34, 197, 94, 0.25)',
      color: '#1f2937',
      lineHeight: 1.6,
      whiteSpace: 'pre-line',
      animation: 'vcFadeLift 0.35s ease both',
    },
    actionRow: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: '0.6rem',
      marginTop: '1rem',
    },
  }), []);

  return (
    <div style={styles.page}>
      <style>{`
        @keyframes vcFadeLift {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .vc-loading-overlay {
          position: fixed;
          inset: 0;
          background: rgba(247, 251, 248, 0.92);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          z-index: 2000;
          backdrop-filter: blur(4px);
        }
        .vc-loading-bubble {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.4rem;
          background: #ffffff;
          border: 1px solid rgba(34, 197, 94, 0.25);
          border-radius: 999px;
          padding: 0.9rem 1.2rem;
          box-shadow: 0 14px 28px rgba(15, 23, 42, 0.08);
        }
        .vc-typing-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22c55e;
          animation: vcTyping 1s infinite ease-in-out;
        }
        .vc-loading-label {
          color: #1b4332;
          font-weight: 700;
          font-size: 0.95rem;
        }
        .vc-crop-overlay {
          position: fixed;
          inset: 0;
          background: rgba(247, 251, 248, 0.92);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          z-index: 2200;
          backdrop-filter: blur(4px);
        }
        .vc-clouds {
          position: relative;
          width: 180px;
          height: 80px;
        }
        .vc-cloud {
          position: absolute;
          background: #ffffff;
          border-radius: 999px;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.08);
          animation: vcFloat 1.8s ease-in-out infinite;
        }
        .vc-cloud.one {
          width: 120px;
          height: 44px;
          left: 0;
          top: 18px;
        }
        .vc-cloud.two {
          width: 90px;
          height: 34px;
          right: 0;
          top: 0;
          animationDelay: 0.2s;
        }
        .vc-drops {
          display: flex;
          gap: 10px;
          margin-top: 8px;
        }
        .vc-drop {
          width: 8px;
          height: 14px;
          background: #60a5fa;
          border-radius: 999px;
          animation: vcDrop 0.9s ease-in-out infinite;
        }
        .vc-drop:nth-child(2) { animationDelay: 0.2s; }
        .vc-drop:nth-child(3) { animationDelay: 0.4s; }
        @keyframes vcFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes vcDrop {
          0% { transform: translateY(-6px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(8px); opacity: 0; }
        }
        @keyframes vcTyping {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; }
        }
      `}</style>
      {pageLoading && (
        <div className="vc-loading-overlay">
          <div className="vc-loading-bubble">
            <span className="vc-typing-dot" style={{ animationDelay: '0s' }}></span>
            <span className="vc-typing-dot" style={{ animationDelay: '0.2s' }}></span>
            <span className="vc-typing-dot" style={{ animationDelay: '0.4s' }}></span>
          </div>
          <div className="vc-loading-label">Preparing voice assistant...</div>
        </div>
      )}
      {cropLoading && (
        <div className="vc-crop-overlay">
          <div className="vc-clouds">
            <span className="vc-cloud one"></span>
            <span className="vc-cloud two"></span>
          </div>
          <div className="vc-drops">
            <span className="vc-drop"></span>
            <span className="vc-drop"></span>
            <span className="vc-drop"></span>
          </div>
          <div className="vc-loading-label">Opening Crop Prediction...</div>
        </div>
      )}
      <div style={styles.header}>
        <div style={styles.title}>
          <MessageCircle size={32} color="#22c55e" />
          {t('voiceChat', 'Voice Help Chat')}
        </div>
        <button
          style={{ ...styles.button, ...styles.ghost, position: 'absolute', right: 0 }}
          type="button"
          onClick={() => navigate('/home')}
        >
          {t('backHome', 'Back to Home')}
        </button>
      </div>

      <div style={{ ...styles.card, animationDelay: '40ms' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Globe size={18} color="#22c55e" />
            <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value)}>
              {LANG_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Gauge size={18} color="#22c55e" />
            <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
              {SPEED_OPTIONS.map((rate) => (
                <option key={rate} value={rate}>{rate.toFixed(1)}x</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.controls}>
          <button style={styles.button} type="button" onClick={handleStartListening} disabled={(!canRecordAudio && !SpeechRecognition) || listening}>
            <Mic size={16} /> {lz('Start Listening', 'سُننا شروع کریں', 'सुनना शुरू करें')}
          </button>
          <button style={{ ...styles.button, ...styles.ghost }} type="button" onClick={handleStopListening} disabled={!listening}>
            <MicOff size={16} /> {lz('Stop', 'روکیں', 'रोकें')}
          </button>
          <button style={{ ...styles.button, ...styles.ghost }} type="button" onClick={() => speak(response)} disabled={!response}>
            <Play size={16} /> {lz('Play Answer', 'جواب سنائیں', 'उत्तर सुनाएँ')}
          </button>
          <button style={{ ...styles.button, ...styles.ghost }} type="button" onClick={stopSpeak}>
            <StopCircle size={16} /> {lz('Stop Audio', 'آڈیو بند کریں', 'ऑडियो रोकें')}
          </button>
        </div>

        <input
          style={styles.input}
          placeholder={lz('Ask in English, Urdu, or Hindi...', 'اردو، انگریزی یا ہندی میں سوال پوچھیں...', 'अंग्रेज़ी, उर्दू या हिंदी में पूछें...')}
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAsk(transcript);
          }}
        />

        <div style={styles.controls}>
          <button style={{ ...styles.button, ...styles.ghost }} type="button" onClick={() => handleAsk(transcript)}>
            <HelpCircle size={16} /> {lz('Get Help', 'مدد حاصل کریں', 'मदद लें')}
          </button>
        </div>

        {response && (
          <div style={styles.response}>
            {response}
          </div>
        )}

        {actions.length > 0 && (
          <div style={styles.actionRow}>
            {actions.map((action) => (
              <button
                key={action.key}
                type="button"
                style={{ ...styles.button, ...styles.ghost }}
                onClick={() => handleActionClick(action)}
              >
                {uiLang === 'ur' ? action.label.ur : (uiLang === 'hi' ? action.label.hi : action.label.en)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ ...styles.card, marginTop: '1.5rem', animationDelay: '120ms' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#1f2937' }}>
          {lz('Try asking', 'یہ سوال پوچھیں', 'ये सवाल पूछें')}
        </div>
        <div style={styles.actionRow}>
          {DEFAULT_SUGGESTIONS.map((question) => {
            const label = uiLang === 'ur' ? question.ur : (uiLang === 'hi' ? question.hi : question.en);
            return (
              <button
                key={question.en}
                type="button"
                style={{ ...styles.button, ...styles.ghost }}
                onClick={() => handleAsk(label)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ ...styles.card, marginTop: '1.5rem', animationDelay: '180ms' }}>
        <div style={{ fontWeight: 700, marginBottom: '0.75rem', color: '#1f2937' }}>
          {lz('More questions', 'مزید سوالات', 'और सवाल')}
        </div>
        <div style={styles.actionRow}>
          {EXTRA_SUGGESTIONS.map((question) => {
            const label = uiLang === 'ur' ? question.ur : (uiLang === 'hi' ? question.hi : question.en);
            return (
              <button
                key={question.en}
                type="button"
                style={{ ...styles.button, ...styles.ghost }}
                onClick={() => handleAsk(label)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {!SpeechRecognition && !canRecordAudio && (
        <div style={{ marginTop: '1rem', color: '#ef4444' }}>
          {lz(
            'Speech recognition is not supported in this browser. Please type your question.',
            'اس براؤزر میں اسپیچ ریکگنیشن دستیاب نہیں۔ براہ کرم سوال ٹائپ کریں۔',
            'इस ब्राउज़र में स्पीच रिकग्निशन उपलब्ध नहीं है। कृपया अपना सवाल टाइप करें।'
          )}
        </div>
      )}
    </div>
  );
}
