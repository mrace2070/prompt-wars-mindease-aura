import React, { useState, useEffect, useRef } from 'react';
import { 
  Brain, 
  Activity, 
  Sparkles, 
  MessageCircle, 
  Compass, 
  Settings as SettingsIcon, 
  Send, 
  ChevronRight, 
  X, 
  Heart, 
  Calendar, 
  Play, 
  Pause, 
  User, 
  RefreshCw
} from 'lucide-react';
import type { MoodEntry, Message, MindfulnessExercise, JournalAnalysis } from './types';
import { analyzeJournalEntry, getCompanionResponse, generateMindfulnessExercise } from './gemini';
import './App.css';

// Default mock entries to give the user an immediately beautiful dashboard experience
const DEFAULT_MOOD_ENTRIES: MoodEntry[] = [
  {
    id: 'entry-1',
    date: '2026-06-09',
    mood: 'good',
    journalText: 'Completed my organic chemistry revision today. Felt good to get that block out of the way, though physical chemistry remains a pain.',
    analysis: {
      sentiment: "Satisfied with organic chemistry progress, minor anxiety about physical chemistry.",
      dominantEmotions: ["Focus", "Satisfaction", "Minor Anxiety"],
      stressLevel: 4,
      hiddenTriggers: ["Physical chemistry syllabus"],
      copingStrategies: ["Break physical chemistry into 3 micro-topics", "Do 5 mock questions daily", "Take a short walk between study blocks"],
      cognitiveDistortions: [],
      personalizedEncouragement: "Excellent focus today! Crossing off organic chemistry is a huge win. Tackle physical chemistry in small, manageable pieces. You've got this."
    }
  },
  {
    id: 'entry-2',
    date: '2026-06-10',
    mood: 'anxious',
    journalText: 'Took a mock test and scored 10% lower than my target. I am starting to panic that I won\'t clear the cutoff. Everyone else seems so prepared.',
    analysis: {
      sentiment: "High anxiety and panic following a lower mock test score, coupled with peer comparison.",
      dominantEmotions: ["Panic", "Self-Doubt", "Inadequacy"],
      stressLevel: 8,
      hiddenTriggers: ["Mock test scores", "Fear of missing cutoffs", "Peer comparison"],
      copingStrategies: [
        "Review errors on the mock test as learning opportunities, not validation of intelligence.",
        "Stop talking to peers about test scores for 48 hours to regain focus.",
        "Practice deep breathing exercises before testing."
      ],
      cognitiveDistortions: ["Catastrophizing (believing one test score determines the final result)", "Overgeneralization"],
      personalizedEncouragement: "Mock tests are tools for mistakes, not final verdicts. Do not let one score cloud your hard work. I know it's hard, but try to compare yourself only to yesterday's version of you."
    }
  },
  {
    id: 'entry-3',
    date: '2026-06-11',
    mood: 'exhausted',
    journalText: 'Only slept 4 hours last night trying to finish the biology notes. Head is pounding and I cannot focus on physics problems today. I feel like crying.',
    analysis: {
      sentiment: "Severe physical and mental exhaustion from sleep deprivation and study pressure.",
      dominantEmotions: ["Burnout", "Exhaustion", "Overwhelm"],
      stressLevel: 9,
      hiddenTriggers: ["Sleep deprivation", "Constant syllabus pressure", "Lack of academic rest"],
      copingStrategies: [
        "Take a mandatory 2-hour nap immediately.",
        "Set a hard 8-hour sleep rule tonight to restore cognitive function.",
        "Put away physics formulas today; do light reading or rest instead."
      ],
      cognitiveDistortions: ["Should statements ('I should be able to study physics on 4 hours of sleep')"],
      personalizedEncouragement: "Your brain is exhausted, and you cannot study productively under these conditions. Rest is not lazy; it is an active part of your exam strategy. Please sleep."
    }
  },
  {
    id: 'entry-4',
    date: '2026-06-12',
    mood: 'neutral',
    journalText: 'Slept better last night. Physics went okay today. Still feeling behind, but not panicking as much. Tried the 5-4-3-2-1 grounding exercise.',
    analysis: {
      sentiment: "Recovering stability, manageable academic pressure.",
      dominantEmotions: ["Neutrality", "Calm", "Acceptance"],
      stressLevel: 5,
      hiddenTriggers: ["Syllabus backlog"],
      copingStrategies: ["Stick to the regular sleep cycle", "Focus on current topics rather than looking at the whole syllabus at once"],
      cognitiveDistortions: [],
      personalizedEncouragement: "It is wonderful to see you recovering your balance. Consistency is key. Keeping your sleep cycle stable is a huge win. One topic at a time."
    }
  }
];

const DEFAULT_MESSAGES: Message[] = [
  {
    id: 'msg-1',
    sender: 'aura',
    text: "Hi there! I'm Aura, your wellness digital companion. Whether you're stressed about mock tests, syllabus backlogs, parent expectations, or just feeling burnt out—I'm here to support you without judgment. How are you feeling today?",
    timestamp: new Date(Date.now() - 3600000).toISOString()
  }
];

const INITIAL_EXERCISES: MindfulnessExercise[] = [
  {
    id: 'ex-1',
    title: '5-Minute Test Anxiety Decompression',
    description: 'Designed specifically to calm racing thoughts before entering an exam hall.',
    type: 'grounding',
    duration: 5,
    steps: [
      'Find a seated, comfortable position. Keep your feet flat on the floor and hands on your thighs.',
      'Close your eyes and focus on the physical weight of your body pressing into the chair.',
      'Take a slow deep breath in through your nose for 5 seconds, hold for 2, and release with a long sigh.',
      'Mentally scan your body for tension in your shoulders, jaw, and chest, and actively release it on each exhale.',
      'Repeat the affirmation: "I have prepared, I am present, and I will handle this one question at a time."'
    ]
  },
  {
    id: 'ex-2',
    title: 'Box Breathing for Nervous System Reset',
    description: 'A scientifically backed breathing method to drop cortisol levels instantly.',
    type: 'breathing',
    duration: 3,
    steps: [
      'Sit comfortably and exhale all the air out of your lungs.',
      'Inhale slowly through your nose for 4 seconds.',
      'Hold your breath completely for 4 seconds.',
      'Exhale smoothly through your mouth for 4 seconds.',
      'Hold empty for 4 seconds, then repeat the loop for 3 minutes.'
    ]
  }
];

const sanitizeInput = (val: string): string => {
  return val
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

let idCounter = 0;
const getNextId = (prefix: string): string => {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
};

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'journal' | 'chat' | 'mindfulness' | 'settings'>('dashboard');

  // Core Data States (persisted in localStorage)

  const [examType, setExamType] = useState<string>(() => localStorage.getItem('aura_exam_type') || 'JEE');

  const [moodEntries, setMoodEntries] = useState<MoodEntry[]>(() => {
    const stored = localStorage.getItem('aura_mood_entries');
    return stored ? JSON.parse(stored) : DEFAULT_MOOD_ENTRIES;
  });
  const [chatMessages, setChatMessages] = useState<Message[]>(() => {
    const stored = localStorage.getItem('aura_chat_messages');
    return stored ? JSON.parse(stored) : DEFAULT_MESSAGES;
  });
  const [customExercises, setCustomExercises] = useState<MindfulnessExercise[]>(() => {
    const stored = localStorage.getItem('aura_custom_exercises');
    return stored ? JSON.parse(stored) : INITIAL_EXERCISES;
  });

  // Journaling Form States
  const [journalText, setJournalText] = useState('');
  const [selectedMood, setSelectedMood] = useState<'excellent' | 'good' | 'neutral' | 'anxious' | 'exhausted'>('neutral');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<JournalAnalysis | null>(null);

  // Chat Input State
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Mindfulness Breathing Guide States
  const [breathingActive, setBreathingActive] = useState(false);
  const [breathPhase, setBreathPhase] = useState<'Inhale' | 'Hold' | 'Exhale' | 'Hold Empty'>('Inhale');
  const [breathCountdown, setBreathCountdown] = useState(4);
  const breathingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Modal State for Mindfulness Exercises
  const [activeExerciseModal, setActiveExerciseModal] = useState<MindfulnessExercise | null>(null);
  const [isGeneratingExercise, setIsGeneratingExercise] = useState(false);

  // Persist states to localStorage
  useEffect(() => {
    localStorage.setItem('aura_mood_entries', JSON.stringify(moodEntries));
  }, [moodEntries]);

  useEffect(() => {
    localStorage.setItem('aura_chat_messages', JSON.stringify(chatMessages));
  }, [chatMessages]);

  useEffect(() => {
    localStorage.setItem('aura_custom_exercises', JSON.stringify(customExercises));
  }, [customExercises]);

  useEffect(() => {
    localStorage.setItem('aura_exam_type', examType);
  }, [examType]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (activeTab === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, activeTab]);

  const handleToggleBreathing = () => {
    setBreathingActive(prev => {
      const nextActive = !prev;
      if (!nextActive) {
        setBreathCountdown(4);
        setBreathPhase('Inhale');
      }
      return nextActive;
    });
  };

  // Breathing Cycle Logic
  useEffect(() => {
    if (breathingActive) {
      breathingTimerRef.current = setInterval(() => {
        setBreathCountdown(prev => {
          if (prev <= 1) {
            // Shift phase
            setBreathPhase(current => {
              switch (current) {
                case 'Inhale': return 'Hold';
                case 'Hold': return 'Exhale';
                case 'Exhale': return 'Hold Empty';
                case 'Hold Empty': return 'Inhale';
                default: return 'Inhale';
              }
            });
            return 4; // Reset to 4 seconds for box breathing
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current);
        breathingTimerRef.current = null;
      }
    }

    return () => {
      if (breathingTimerRef.current) {
        clearInterval(breathingTimerRef.current);
      }
    };
  }, [breathingActive]);

  // API key is hardcoded directly in the source code

  // Analyze a journal entry
  const handleSubmitJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!journalText.trim()) return;

    setIsAnalyzing(true);
    try {
      const sanitizedText = sanitizeInput(journalText);
      const analysisResult = await analyzeJournalEntry(sanitizedText, selectedMood, examType);
      
      const newEntry: MoodEntry = {
        id: getNextId('entry'),
        date: new Date().toISOString().split('T')[0],
        mood: selectedMood,
        journalText: sanitizedText,
        analysis: analysisResult
      };

      setMoodEntries(prev => [newEntry, ...prev]);
      setCurrentAnalysis(analysisResult);
      setJournalText('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Send a chat message
  const handleSendChatMessage = async (textToSend?: string) => {
    const messageText = textToSend || chatInput;
    if (!messageText.trim()) return;

    if (!textToSend) setChatInput('');
    const sanitizedText = sanitizeInput(messageText);

    const newUserMsg: Message = {
      id: getNextId('msg'),
      sender: 'user',
      text: sanitizedText,
      timestamp: new Date().toISOString()
    };

    setChatMessages(prev => [...prev, newUserMsg]);
    setIsTyping(true);

    try {
      // Get recent journals to supply context to AI
      const recentJournals = moodEntries.slice(0, 3);
      const updatedHistory = [...chatMessages, newUserMsg];
      const botResponse = await getCompanionResponse(updatedHistory, recentJournals, examType);

      const newBotMsg: Message = {
        id: getNextId('msg'),
        sender: 'aura',
        text: botResponse,
        timestamp: new Date().toISOString()
      };

      setChatMessages(prev => [...prev, newBotMsg]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTyping(false);
    }
  };

  // Generate a custom mindfulness exercise based on recent triggers
  const handleGenerateCustomExercise = async () => {
    setIsGeneratingExercise(true);
    try {
      // Gather active stress triggers from last few journals
      const recentTriggers = Array.from(
        new Set(
          moodEntries
            .slice(0, 3)
            .flatMap(entry => entry.analysis?.hiddenTriggers || [])
        )
      );

      const response = await generateMindfulnessExercise(selectedMood, recentTriggers, examType);
      
      const newExercise: MindfulnessExercise = {
        ...response,
        id: getNextId('ex')
      };

      setCustomExercises(prev => [newExercise, ...prev]);
      setActiveExerciseModal(newExercise);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingExercise(false);
    }
  };

  // Clear all logs/history
  const handleClearData = () => {
    if (window.confirm("Are you sure you want to clear your journaling and chat history? This cannot be undone.")) {
      setMoodEntries([]);
      setChatMessages(DEFAULT_MESSAGES);
      setCustomExercises(INITIAL_EXERCISES);
      setCurrentAnalysis(null);
    }
  };

  // Quick Chat Prompts
  const QUICK_PROMPTS = [
    "I feel overwhelmed by my backlog.",
    "Help me calm my mind before study.",
    "Dealing with high expectations from parents.",
    "I'm burnt out. How do I recharge?"
  ];

  // Helper metrics for Dashboard
  const averageStress = moodEntries.length > 0 
    ? Math.round(moodEntries.reduce((acc, curr) => acc + (curr.analysis?.stressLevel || 0), 0) / moodEntries.length * 10) / 10
    : 0;

  const allTriggers = moodEntries.flatMap(e => e.analysis?.hiddenTriggers || []);
  const topTriggers = Array.from(new Set(allTriggers))
    .map(trigger => ({
      name: trigger,
      count: allTriggers.filter(t => t === trigger).length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const allEmotions = moodEntries.flatMap(e => e.analysis?.dominantEmotions || []);
  const topEmotions = Array.from(new Set(allEmotions))
    .map(emotion => ({
      name: emotion,
      count: allEmotions.filter(e => e === emotion).length
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // SVG Chart drawing calculations
  // We want to map last 6 mood entries onto an SVG path (width: 500, height: 150)
  const chartEntries = [...moodEntries].reverse().slice(-6);
  const width = 500;
  const height = 150;
  const padding = 20;

  let pathD = '';
  let areaD = '';
  const points: {x: number, y: number, entry: MoodEntry}[] = [];

  if (chartEntries.length > 1) {
    const dx = (width - padding * 2) / (chartEntries.length - 1);
    chartEntries.forEach((entry, idx) => {
      const x = padding + idx * dx;
      // Stress is 1-10. Map 10 to padding, 1 to height - padding
      const stressVal = entry.analysis?.stressLevel || 5;
      const y = padding + (height - padding * 2) * (1 - (stressVal - 1) / 9);
      points.push({ x, y, entry });
    });

    pathD = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="logo-section">
          <Brain className="logo-icon" size={32} aria-hidden="true" />
          <h1 className="logo-text">Aura</h1>
          <span className="exam-badge" aria-label={`Competitive Exam Wellness Companion - Target Exam is ${examType}`}>{examType} EXAM WELLNESS</span>
        </div>
        
        <nav className="app-nav" role="tablist" aria-label="Aura Companion Navigation">
          <button 
            id="dashboard-tab"
            role="tab"
            aria-selected={activeTab === 'dashboard'}
            aria-controls="dashboard-tabpanel"
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Activity size={16} aria-hidden="true" /> Dashboard
          </button>
          <button 
            id="journal-tab"
            role="tab"
            aria-selected={activeTab === 'journal'}
            aria-controls="journal-tabpanel"
            className={`nav-item ${activeTab === 'journal' ? 'active' : ''}`}
            onClick={() => setActiveTab('journal')}
          >
            <Sparkles size={16} aria-hidden="true" /> Journal & Log
          </button>
          <button 
            id="chat-tab"
            role="tab"
            aria-selected={activeTab === 'chat'}
            aria-controls="chat-tabpanel"
            className={`nav-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageCircle size={16} aria-hidden="true" /> Aura Companion
          </button>
          <button 
            id="mindfulness-tab"
            role="tab"
            aria-selected={activeTab === 'mindfulness'}
            aria-controls="mindfulness-tabpanel"
            className={`nav-item ${activeTab === 'mindfulness' ? 'active' : ''}`}
            onClick={() => setActiveTab('mindfulness')}
          >
            <Compass size={16} aria-hidden="true" /> Mindfulness
          </button>
          <button 
            id="settings-tab"
            role="tab"
            aria-selected={activeTab === 'settings'}
            aria-controls="settings-tabpanel"
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <SettingsIcon size={16} aria-hidden="true" /> Settings
          </button>
        </nav>
      </header>



      {/* Main Content */}
      <main className="main-content">
        
        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div role="tabpanel" id="dashboard-tabpanel" aria-labelledby="dashboard-tab" className="dashboard-grid">
            <div className="dashboard-left">
              
              {/* Target Exam Context Selector */}
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <h3 className="card-title" style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.15rem' }}>
                  <Brain size={18} className="logo-icon" style={{ animation: 'none' }} aria-hidden="true" />
                  Target Competitive Exam Context
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Aura customizes your mood analysis, hidden triggers, and digital coping strategies for:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {['JEE', 'NEET', 'UPSC', 'GATE', 'CAT', 'CUET', 'Board Exams'].map((exam) => (
                    <button
                      key={exam}
                      type="button"
                      onClick={() => setExamType(exam)}
                      className={`mood-btn ${examType === exam ? 'active' : ''}`}
                      style={{
                        padding: '0.4rem 0.8rem',
                        fontSize: '0.8rem',
                        borderRadius: 'var(--radius-sm)',
                        flex: '1 1 0px',
                        minWidth: '70px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        border: examType === exam ? '1px solid var(--color-primary-light)' : '1px solid var(--border-color)',
                        background: examType === exam ? 'var(--color-primary-glow)' : 'rgba(255, 255, 255, 0.02)',
                        color: examType === exam ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      {exam}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily Motivation Card */}
              <div className="tips-banner">
                <Heart className="tips-icon" size={24} aria-hidden="true" />
                <div className="tips-content">
                  <span className="tips-title">Aura's Reminder For You Today</span>
                  <span className="tips-body">
                    {moodEntries[0]?.analysis?.personalizedEncouragement || 
                     "Remember, exam preparation is a marathon, not a sprint. Your cognitive ability is highly dependent on rest, water, and self-compassion. Take a deep breath."}
                  </span>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="metrics-row">
                <div className="metric-card">
                  <div className="metric-header">
                    Average Stress
                    <Activity size={14} className="text-secondary" aria-hidden="true" />
                  </div>
                  <div className="metric-value" style={{ 
                    color: averageStress > 7 ? 'var(--color-danger)' : averageStress > 4 ? 'var(--color-warning)' : 'var(--color-success)' 
                  }}>
                    {averageStress > 0 ? `${averageStress} / 10` : 'N/A'}
                  </div>
                  <div className="metric-sub">
                    {averageStress > 7 ? 'High Burnout Risk' : averageStress > 4 ? 'Moderate Pressure' : 'Balanced Headspace'}
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    Logged Entries
                    <Calendar size={14} aria-hidden="true" />
                  </div>
                  <div className="metric-value">{moodEntries.length}</div>
                  <div className="metric-sub">Active journals logged</div>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    Primary Companion
                  </div>
                  <div className="metric-value" style={{ color: 'var(--color-primary-light)' }}>Aura</div>
                  <div className="metric-sub">Always online & responsive</div>
                </div>
              </div>

              {/* Stress Level Chart */}
              <div className="glass-card">
                <h3 className="card-title">Stress Level Trends (Last 6 Logs)</h3>
                {chartEntries.length > 1 ? (
                  <div className="chart-container">
                    <svg className="chart-svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>
                      
                      {/* Grid Lines */}
                      {[1, 5, 10].map(val => {
                        const y = padding + (height - padding * 2) * (1 - (val - 1) / 9);
                        return (
                          <g key={val}>
                            <line className="chart-grid-line" x1={padding} y1={y} x2={width - padding} y2={y} />
                            <text className="chart-y-label" x={padding - 5} y={y + 3}>{val}</text>
                          </g>
                        );
                      })}

                      {/* Area under curve */}
                      <path className="chart-area" d={areaD} />

                      {/* Main Line */}
                      <path className="chart-line" d={pathD} />

                      {/* Points */}
                      {points.map((p) => (
                        <g key={p.entry.id}>
                          <circle className="chart-dot" cx={p.x} cy={p.y} r={4} />
                          <text className="chart-label" x={p.x} y={height - 2}>
                            {p.entry.date.substring(5)}
                          </text>
                        </g>
                      ))}
                    </svg>
                  </div>
                ) : (
                  <div className="empty-state">
                    <Activity className="empty-state-icon" aria-hidden="true" />
                    <span>Not enough data yet. Log at least 2 entries in Journal to see trends.</span>
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-right">
              {/* Uncovered Triggers */}
              <div className="glass-card">
                <h3 className="card-title">Uncovered Triggers</h3>
                {topTriggers.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      AI has identified these active external triggers affecting your headspace:
                    </p>
                    <div className="tag-container">
                      {topTriggers.map(t => (
                        <span key={t.name} className="trigger-tag">
                          {t.name} ({t.count}x)
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <span>No triggers analyzed yet. Start journaling!</span>
                  </div>
                )}
              </div>

              {/* Dominant Emotions */}
              <div className="glass-card">
                <h3 className="card-title">Dominant Emotions</h3>
                {topEmotions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Key feelings identified across your open-ended logs:
                    </p>
                    <div className="tag-container">
                      {topEmotions.map(e => (
                        <span key={e.name} className="emotion-tag">
                          {e.name} ({e.count}x)
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="empty-state">
                    <span>No emotions analyzed yet.</span>
                  </div>
                )}
              </div>

              {/* Journal Logs History */}
              <div className="glass-card">
                <h3 className="card-title">Journal History</h3>
                {moodEntries.length > 0 ? (
                  <div className="history-list">
                    {moodEntries.map(e => (
                      <div key={e.id} className="history-item">
                        <div className="history-info">
                          <span className="history-mood-indicator" role="img" aria-label={e.mood}>
                            {e.mood === 'excellent' ? '😊' : e.mood === 'good' ? '🙂' : e.mood === 'neutral' ? '😐' : e.mood === 'anxious' ? '😰' : '😫'}
                          </span>
                          <div className="history-text-col">
                            <span className="history-snippet">{e.journalText}</span>
                            <span className="history-date">{e.date}</span>
                          </div>
                        </div>
                        {e.analysis && (
                          <span className={`history-stress-indicator ${e.analysis.stressLevel > 7 ? 'high' : e.analysis.stressLevel > 4 ? 'medium' : 'low'}`}>
                            Stress {e.analysis.stressLevel}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span>No entries logged yet.</span>
                  </div>
                )}
              </div>

              {/* Crisis Support & Helplines Box */}
              <div className="glass-card" style={{ border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.03)' }}>
                <h3 className="card-title" style={{ color: '#f87171', fontSize: '1.1rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Heart size={16} style={{ color: '#ef4444' }} aria-hidden="true" />
                  Self-Care & Crisis Resources
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  If you are feeling extremely overwhelmed or experiencing a crisis, please reach out to professional services immediately. You are not alone:
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>Kiran Mental Health:</span>
                    <a href="tel:18005990019" style={{ color: 'var(--color-primary-light)', textDecoration: 'none' }}>1800-599-0019</a>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>Tele-MANAS:</span>
                    <a href="tel:14416" style={{ color: 'var(--color-primary-light)', textDecoration: 'none' }}>14416 or 1800-891-4416</a>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 600 }}>Vandrevala Foundation:</span>
                    <a href="tel:+919999666555" style={{ color: 'var(--color-primary-light)', textDecoration: 'none' }}>+91-9999 666 555</a>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 600 }}>SNEHA Suicide Prevention:</span>
                    <a href="tel:+914424640050" style={{ color: 'var(--color-primary-light)', textDecoration: 'none' }}>+91-44-2464 0050</a>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* JOURNAL & LOG TAB */}
        {activeTab === 'journal' && (
          <div role="tabpanel" id="journal-tabpanel" aria-labelledby="journal-tab" className="journal-layout">
            {/* Journal entry form */}
            <div className="glass-card">
              <h3 className="card-title">Open-Ended Daily Journal</h3>
              <form onSubmit={handleSubmitJournal} className="journal-form">
                
                {/* Mood selection */}
                <div className="input-group">
                  <label className="input-label">How is your headspace overall right now?</label>
                  <div className="mood-select-grid">
                    {(['excellent', 'good', 'neutral', 'anxious', 'exhausted'] as const).map(m => {
                      const emojis = { excellent: '😊', good: '🙂', neutral: '😐', anxious: '😰', exhausted: '😫' };
                      return (
                        <button
                          key={m}
                          type="button"
                          className={`mood-btn mood-${m} ${selectedMood === m ? 'active' : ''}`}
                          onClick={() => setSelectedMood(m)}
                          aria-pressed={selectedMood === m}
                        >
                          <span className="mood-emoji" role="img" aria-label={m}>{emojis[m]}</span>
                          <span className="mood-label">{m}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Journal description */}
                <div className="input-group">
                  <label className="input-label">Write down what's on your mind (syllabus, exams, expectations, fatigue...)</label>
                  <textarea
                    value={journalText}
                    onChange={(e) => setJournalText(e.target.value)}
                    placeholder="Write freely. Express any self-doubt, panic, wins, or feelings about your revision schedule..."
                    className="journal-textarea"
                    required
                  />
                </div>

                <button 
                  type="submit" 
                  className="primary-btn" 
                  disabled={isAnalyzing || !journalText.trim()}
                >
                  {isAnalyzing ? (
                    <>
                      <div className="loading-spinner" aria-hidden="true" /> Analyzing Triggers with AI...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} aria-hidden="true" /> Analyze & Log Entry
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Analysis details pane */}
            <div className="glass-card">
              <h3 className="card-title">AI Cognitive & Trigger Analysis</h3>
              
              {currentAnalysis ? (
                <div className="analysis-results">
                  <div className="analysis-header">
                    <div>
                      <h4 style={{ fontWeight: 600 }}>{currentAnalysis.sentiment}</h4>
                      <div className="tag-container" style={{ marginTop: '0.5rem' }}>
                        {currentAnalysis.dominantEmotions.map(e => (
                          <span key={e} className="emotion-tag">{e}</span>
                        ))}
                      </div>
                    </div>
                    <span className={`stress-badge ${currentAnalysis.stressLevel > 7 ? 'high' : currentAnalysis.stressLevel > 4 ? 'medium' : 'low'}`}>
                      Stress: {currentAnalysis.stressLevel}/10
                    </span>
                  </div>

                  {/* Hidden triggers */}
                  {currentAnalysis.hiddenTriggers.length > 0 && (
                    <div className="analysis-block">
                      <div className="analysis-block-title">Stress Triggers Identified</div>
                      <div className="tag-container">
                        {currentAnalysis.hiddenTriggers.map(t => (
                          <span key={t} className="trigger-tag">{t}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cognitive distortions */}
                  {currentAnalysis.cognitiveDistortions.length > 0 && (
                    <div className="analysis-block">
                      <div className="analysis-block-title">Cognitive Distortions Checked</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        {currentAnalysis.cognitiveDistortions.map(d => (
                          <span key={d} style={{
                            background: 'rgba(239, 68, 68, 0.08)',
                            color: '#fca5a5',
                            border: '1px solid rgba(239, 68, 68, 0.15)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600
                          }}>
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coping strategies */}
                  <div className="analysis-block">
                    <div className="analysis-block-title">Actionable Coping Strategies</div>
                    <ul className="coping-list">
                      {currentAnalysis.copingStrategies.map((strategy, idx) => (
                        <li key={idx} className="coping-item">
                          <span className="coping-bullet">✦</span>
                          <span className="analysis-text">{strategy}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Aura encouragement */}
                  <div className="analysis-block" style={{ marginTop: '1.5rem' }}>
                    <div className="analysis-block-title">Aura Companion Quote</div>
                    <div className="aura-quote">
                      "{currentAnalysis.personalizedEncouragement}"
                    </div>
                  </div>
                </div>
              ) : (
                <div className="empty-state" style={{ height: '100%', justifyContent: 'center' }}>
                  <Sparkles className="empty-state-icon" style={{ fontSize: '3rem' }} aria-hidden="true" />
                  <span>Submit a journal log on the left to uncover hidden stressors, cognitive distortions, and coping strategies.</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
          <div role="tabpanel" id="chat-tabpanel" aria-labelledby="chat-tab" className="glass-card chat-layout">
            <h3 className="card-title" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', margin: 0 }}>
              Chat with Aura
            </h3>
            
            {/* Conversation */}
            <div className="chat-history" aria-live="polite">
              {chatMessages.map(m => (
                <div key={m.id} className={`chat-message ${m.sender}`}>
                  <div className="message-avatar">
                    {m.sender === 'user' ? <User size={18} aria-hidden="true" /> : <Brain size={18} aria-hidden="true" />}
                  </div>
                  <div className="message-bubble">
                    {m.text}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="chat-message aura">
                  <div className="message-avatar">
                    <Brain size={18} aria-hidden="true" />
                  </div>
                  <div className="message-bubble" style={{ padding: '0.4rem 0.8rem' }} aria-label="Aura is typing">
                    <div className="bubble-loader">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick Prompt Suggestions */}
            {chatMessages.length === 1 && (
              <div style={{ padding: '0 1rem 0.5rem 1rem' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 600 }}>SUGGESTED DISCUSSIONS:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {QUICK_PROMPTS.map(p => (
                    <button 
                      key={p} 
                      onClick={() => handleSendChatMessage(p)}
                      style={{
                        background: 'rgba(139, 92, 246, 0.08)',
                        border: '1px solid rgba(139, 92, 246, 0.2)',
                        color: 'var(--color-primary-light)',
                        padding: '0.4rem 0.8rem',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        fontFamily: 'var(--font-sans)',
                        transition: 'all var(--transition-fast)'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.15)';
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Row */}
            <div className="chat-input-row">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                placeholder="Talk to Aura about exam stress, burnout, mock test fear..."
                className="chat-input"
                disabled={isTyping}
                aria-label="Type your message to Aura"
              />
              <button 
                onClick={() => handleSendChatMessage()} 
                className="chat-submit-btn"
                disabled={isTyping || !chatInput.trim()}
                aria-label="Send message"
              >
                <Send size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}

        {/* MINDFULNESS OASIS */}
        {activeTab === 'mindfulness' && (
          <div role="tabpanel" id="mindfulness-tabpanel" aria-labelledby="mindfulness-tab" className="mindfulness-layout">
            
            {/* Breathing Circle Guide */}
            <div className="glass-card breathing-card">
              <h3 className="card-title">Interactive Box Breathing</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'center', maxWidth: '300px' }}>
                Used by Navy SEALs and students alike to instantly regulate cortisol and physical panic.
              </p>
              
              <div 
                className={`breathing-circle-outer ${breathingActive ? 'active' : ''}`}
                aria-live="polite"
                aria-label={breathingActive ? `Breathing exercise active: ${breathPhase} for ${breathCountdown} seconds` : "Breathing exercise inactive"}
              >
                <div className="breathing-circle-inner">
                  {breathingActive ? (
                    <>
                      <span className="breathing-instructions">{breathPhase}</span>
                      <span className="breathing-subtitle">{breathCountdown}s</span>
                    </>
                  ) : (
                    <span className="breathing-instructions">Ready</span>
                  )}
                </div>
              </div>

              <button 
                onClick={handleToggleBreathing}
                className="primary-btn"
                style={{ width: '180px' }}
                aria-label={breathingActive ? "Stop box breathing guide" : "Start box breathing guide"}
              >
                {breathingActive ? (
                  <>
                    <Pause size={18} aria-hidden="true" /> Stop Guide
                  </>
                ) : (
                  <>
                    <Play size={18} aria-hidden="true" /> Start Guide
                  </>
                )}
              </button>
            </div>

            {/* Exercise List & Custom Generation */}
            <div className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 className="card-title" style={{ margin: 0 }}>Mindfulness Exercises</h3>
                <button 
                  onClick={handleGenerateCustomExercise}
                  disabled={isGeneratingExercise}
                  className="primary-btn"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                  aria-label="Generate custom mindfulness exercise using AI"
                >
                  {isGeneratingExercise ? (
                    <>
                      <div className="loading-spinner" style={{ width: '14px', height: '14px' }} aria-hidden="true" /> Generating...
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} aria-hidden="true" /> AI Custom Exercise
                    </>
                  )}
                </button>
              </div>

              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
                Select an exercise below to view structured steps. Click 'AI Custom Exercise' to generate a session tailored to your recent stressors.
              </p>

              <div className="mindfulness-list">
                {customExercises.map(ex => (
                  <div 
                    key={ex.id} 
                    className="exercise-item"
                    onClick={() => setActiveExerciseModal(ex)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setActiveExerciseModal(ex);
                      }
                    }}
                    aria-label={`View exercise: ${ex.title}, Type: ${ex.type}, Duration: ${ex.duration} minutes`}
                  >
                    <div className="exercise-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="exercise-title">{ex.title}</span>
                        <span className="exercise-badge">{ex.type}</span>
                      </div>
                      <span className="exercise-desc">{ex.description}</span>
                    </div>
                    <button className="icon-btn-circle" tabIndex={-1} aria-hidden="true">
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div role="tabpanel" id="settings-tabpanel" aria-labelledby="settings-tab" className="glass-card">
            <h3 className="card-title">Settings & Data Integrity</h3>
            <div className="settings-form">
              
              <div className="settings-info">
                <strong>Privacy Guarantee:</strong> All inputs, journals, and logs are analyzed directly through the Gemini client API and saved only inside your local browser. No third-party backend servers are used.
              </div>



              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: '1rem', display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={handleClearData} 
                  className="primary-btn" 
                  style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', boxShadow: 'none' }}
                  aria-label="Clear all local journal and chat history data"
                >
                  Clear Journal & Chat History
                </button>
              </div>

            </div>
          </div>
        )}

      </main>

      {/* MINDFULNESS MODAL PANEL */}
      {activeExerciseModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div className="modal-content">
            <button className="modal-close-btn" onClick={() => setActiveExerciseModal(null)} aria-label="Close mindfulness exercise modal">
              <X size={20} aria-hidden="true" />
            </button>
            <h4 id="modal-title" className="modal-title">{activeExerciseModal.title}</h4>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
              {activeExerciseModal.description} ({activeExerciseModal.duration} min session)
            </p>
            
            <div className="step-card-list">
              {activeExerciseModal.steps.map((step, idx) => (
                <div key={idx} className="step-card-item">
                  <span className="step-number">{idx + 1}</span>
                  <span className="step-text">{step}</span>
                </div>
              ))}
            </div>

            <button 
              className="primary-btn"
              onClick={() => setActiveExerciseModal(null)}
              style={{ width: '100%' }}
              aria-label="Conclude exercise and close modal"
            >
              Conclude Exercise
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
