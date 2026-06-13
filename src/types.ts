export interface JournalAnalysis {
  sentiment: string;
  dominantEmotions: string[];
  stressLevel: number; // 1 to 10
  hiddenTriggers: string[];
  copingStrategies: string[];
  cognitiveDistortions: string[];
  personalizedEncouragement: string;
}

export interface MoodEntry {
  id: string;
  date: string; // ISO String or YYYY-MM-DD
  mood: 'excellent' | 'good' | 'neutral' | 'anxious' | 'exhausted';
  journalText: string;
  analysis?: JournalAnalysis;
}

export interface Message {
  id: string;
  sender: 'user' | 'aura';
  text: string;
  timestamp: string; // ISO String
}

export interface MindfulnessExercise {
  id: string;
  title: string;
  description: string;
  type: 'breathing' | 'grounding' | 'visualization' | 'affirmation';
  duration: number; // in minutes
  steps: string[];
}
