import type { JournalAnalysis, Message, MoodEntry, MindfulnessExercise } from './types';

const GEMINI_API_KEY = (import.meta.env.VITE_GEMINI_API_KEY as string) || '';
const DEFAULT_MODEL = 'gemini-3.5-flash';

function getGeminiUrl(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent`;
}

export async function checkApiKeyValidity(): Promise<{ isValid: boolean; error?: string }> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_API_KEY') || GEMINI_API_KEY.trim() === '') {
    return { isValid: false, error: 'API key is missing or not set in environment variables.' };
  }
  try {
    const response = await fetch(`${getGeminiUrl()}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with "OK"' }] }]
      }),
    });
    
    if (response.ok) {
      return { isValid: true };
    } else {
      try {
        const errorData = await response.json();
        const apiErrorMessage = errorData.error?.message || response.statusText;
        return { 
          isValid: false, 
          error: `API Error (${response.status}): ${apiErrorMessage}` 
        };
      } catch {
        return { 
          isValid: false, 
          error: `HTTP Error ${response.status}: ${response.statusText}` 
        };
      }
    }
  } catch (e: unknown) {
    const errorMsg = e instanceof Error ? e.message : String(e);
    console.error('Validation fetch error:', e);
    return { 
      isValid: false, 
      error: `Network Error: Could not connect to Google API. ${errorMsg}` 
    };
  }
}

export async function analyzeJournalEntry(
  text: string = '',
  mood: string = 'neutral',
  examType: string = 'JEE'
): Promise<JournalAnalysis> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_API_KEY') || GEMINI_API_KEY.trim() === '') {
    console.warn('Gemini API key is not configured. Falling back to mock analysis.');
    return getMockAnalysis(mood);
  }
  const prompt = `You are a compassionate, professional AI wellness counselor specialized in supporting students during high-stakes board exams and competitive entrance tests (e.g. JEE, NEET, UPSC, GATE, CAT, board exams).
Analyze the following student's journal entry. They are preparing for the ${examType} exam.
Journal Entry: "${text}"
Mood reported: "${mood}"

Extract the following in JSON format:
- sentiment: A brief one-phrase summary of their mental state.
- dominantEmotions: An array of key emotions detected (e.g., Anxiety, Self-Doubt, Exhaustion, Hope, Pressure, Focus).
- stressLevel: An integer between 1 (no stress) and 10 (extreme burnout/panic).
- hiddenTriggers: An array of stress triggers identified (e.g., parental expectation, peer comparison, syllabus backlog, sleep deprivation, fear of failure, test anxiety).
- copingStrategies: An array of 3 specific, actionable coping strategies tailored to their context (such as custom academic breaks, study strategies, self-care, or mental resets).
- cognitiveDistortions: An array of negative thinking patterns detected (e.g., catastrophizing, all-or-nothing thinking, overgeneralization, personalization, should statements), if any.
- personalizedEncouragement: A warm, empathetic, and motivational note from their companion 'Aura' (2-3 sentences max).

The JSON output MUST match this structure exactly:
{
  "sentiment": "...",
  "dominantEmotions": ["..."],
  "stressLevel": 5,
  "hiddenTriggers": ["..."],
  "copingStrategies": ["..."],
  "cognitiveDistortions": ["..."],
  "personalizedEncouragement": "..."
}`;

  try {
    const response = await fetch(`${getGeminiUrl()}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned error: ${response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('Empty response from Gemini');

    return JSON.parse(responseText.trim()) as JournalAnalysis;
  } catch (error) {
    console.error('Error calling Gemini for analysis, using fallback:', error);
    return getMockAnalysis(mood);
  }
}

export async function getCompanionResponse(
  chatHistory: Message[] = [],
  recentEntries: MoodEntry[] = [],
  examType: string = 'JEE'
): Promise<string> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_API_KEY') || GEMINI_API_KEY.trim() === '') {
    console.warn('Gemini API key is not configured. Falling back to default companion response.');
    return "I am here for you. Although I'm in offline support mode right now, please know that you are doing your absolute best. Take a deep breath and take one task at a time.";
  }
  // Format context
  const journalContext = recentEntries.length > 0
    ? `Recent Journal Entries for context:\n${recentEntries.map(e => `- Date: ${e.date}, Mood: ${e.mood}, Journal: "${e.journalText}"${e.analysis ? `, Triggers: ${e.analysis.hiddenTriggers.join(', ')}` : ''}`).join('\n')}`
    : "No recent journal entries logged yet.";

  const formattedHistory = chatHistory.map(m => `${m.sender === 'user' ? 'Student' : 'Aura'}: ${m.text}`).join('\n');

  const systemInstruction = `You are Aura, an empathetic, safe, and always-available digital companion for a student preparing for the intense competitive exam: ${examType}. You understand the pressure, self-doubt, syllabus load, parent pressure, and exhaustion they experience specifically preparing for ${examType}.
Your tone is warm, non-judgmental, friendly, and deeply caring.
Here is the context of their recent journal entries:
${journalContext}

Here is the conversation history:
${formattedHistory}

Please respond to the student's latest message with deep empathy and constructive wellness advice. Keep your response relatively concise (2-4 sentences), supportive, and clear. Avoid sounding robotic, clinical, or overly formal. Speak like a supportive peer or kind mentor.
If they express high-stress or self-harm thoughts, provide a gentle, supportive disclaimer and recommend professional help (e.g. student helpline).`;

  try {
    const response = await fetch(`${getGeminiUrl()}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemInstruction }] }],
        generationConfig: {
          temperature: 0.8,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "I am here for you. How else can I help?";
  } catch (error) {
    console.error('Error getting companion response:', error);
    return "I'm having a little trouble connecting right now, but I want you to know I'm standing by you. Take a deep breath. You are doing your best.";
  }
}

export async function generateMindfulnessExercise(
  mood: string = 'neutral',
  triggers: string[] = [],
  examType: string = 'JEE'
): Promise<MindfulnessExercise> {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.includes('YOUR_API_KEY') || GEMINI_API_KEY.trim() === '') {
    console.warn('Gemini API key is not configured. Falling back to mock exercise.');
    return getMockExercise(mood);
  }
  const triggersText = triggers.length > 0 ? triggers.join(', ') : 'general exam pressure';
  const prompt = `You are a meditation and mindfulness expert. Design a simple, custom mindfulness or grounding exercise for a student preparing for the ${examType} exam.
Their current mood is: "${mood}"
Their active stress triggers are: "${triggersText}"

Create a custom mindfulness session in JSON format:
- title: A comforting, engaging title.
- description: A 1-sentence description of how this helps.
- type: One of "breathing", "grounding", "visualization", "affirmation".
- duration: Suggested duration in minutes (e.g., 2, 3, or 5).
- steps: An array of 4-5 clear, calming steps that guide them through the exercise.

The JSON output MUST match this structure exactly:
{
  "title": "...",
  "description": "...",
  "type": "breathing",
  "duration": 3,
  "steps": ["Step 1...", "Step 2...", "Step 3...", "Step 4..."]
}`;

  try {
    const response = await fetch(`${getGeminiUrl()}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.7,
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`API returned error: ${response.statusText}`);
    }

    const data = await response.json();
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) throw new Error('Empty response');

    return JSON.parse(responseText.trim()) as MindfulnessExercise;
  } catch (error) {
    console.error('Error generating exercise, using fallback:', error);
    return getMockExercise(mood);
  }
}

// Fallback Mock Creators
function getMockAnalysis(mood: string): JournalAnalysis {
  const mockTemplates: Record<string, JournalAnalysis> = {
    anxious: {
      sentiment: "Highly anxious about upcoming examinations and academic expectations.",
      dominantEmotions: ["Anxiety", "Fear of Failure", "Pressure"],
      stressLevel: 8,
      hiddenTriggers: ["Academic backlog", "Parental pressure", "Lack of mock test confidence"],
      copingStrategies: [
        "Use the 50-10 Pomodoro rule to study without feeling overwhelmed.",
        "Practice Box Breathing for 2 minutes before opening your books.",
        "Focus on what you can control: write down today's 3 smallest achievable tasks."
      ],
      cognitiveDistortions: ["Catastrophizing (assuming failing one test means failing life)", "Should statements"],
      personalizedEncouragement: "I hear how much weight you are carrying on your shoulders right now. Take a slow, deep breath. This exam does not define your entire worth as a human being. Let's tackle this one step at a time."
    },
    exhausted: {
      sentiment: "Severe physical and mental burnout from continuous study sessions.",
      dominantEmotions: ["Fatigue", "Burnout", "Overwhelm"],
      stressLevel: 9,
      hiddenTriggers: ["Sleep deprivation", "Constant study without breaks", "High self-doubt"],
      copingStrategies: [
        "Go offline for 30 minutes and take a short walk or rest.",
        "Set a hard sleep boundary: no screens or books 45 minutes before sleep.",
        "Rehydrate and do a light physical stretch."
      ],
      cognitiveDistortions: ["All-or-nothing thinking"],
      personalizedEncouragement: "You've been pushing yourself incredibly hard, but rest is actually a critical part of preparation. Pushing through exhaustion only reduces your retention. Give yourself permission to sleep tonight."
    },
    neutral: {
      sentiment: "Steady, but dealing with routine preparation stress.",
      dominantEmotions: ["Calm", "Acceptance", "Routine stress"],
      stressLevel: 4,
      hiddenTriggers: ["Routine exam preparation", "Peer comparisons"],
      copingStrategies: [
        "Review your achievements from the past week to reinforce progress.",
        "Engage in a 5-minute active stretching routine.",
        "Share a quick laugh or conversation with a friend."
      ],
      cognitiveDistortions: [],
      personalizedEncouragement: "You're doing great keeping a steady pace. Consistency is your superpower. Keep moving forward, and remember to schedule little moments of joy today."
    },
    good: {
      sentiment: "Positive outlook with manageable stress.",
      dominantEmotions: ["Hope", "Focus", "Optimism"],
      stressLevel: 3,
      hiddenTriggers: ["Minor time management issues"],
      copingStrategies: [
        "Jot down your current study momentum to review during tougher days.",
        "Take a moment to appreciate your focus today.",
        "Ensure you take proper lunch and dinner breaks."
      ],
      cognitiveDistortions: [],
      personalizedEncouragement: "It's wonderful to see you in this headspace! Celebrate this momentum—it proves what you are capable of when you balance your focus. Keep shining!"
    },
    excellent: {
      sentiment: "Excellent focus, low stress, high confidence.",
      dominantEmotions: ["Confidence", "Excitement", "Clarity"],
      stressLevel: 2,
      hiddenTriggers: ["Slight over-confidence leading to potential fatigue"],
      copingStrategies: [
        "Maintain this healthy routine.",
        "Offer a word of encouragement to a study buddy.",
        "Write down what clicked for you today so you can repeat it."
      ],
      cognitiveDistortions: [],
      personalizedEncouragement: "You are absolutely in the zone! Keep riding this wave of confidence. Remember this feeling; you worked hard to build this momentum."
    }
  };

  return mockTemplates[mood] || mockTemplates['neutral'];
}

function getMockExercise(mood: string): MindfulnessExercise {
  if (mood === 'exhausted' || mood === 'anxious') {
    return {
      id: 'mock-1',
      title: 'Mindful Grounding (5-4-3-2-1 Technique)',
      description: 'A simple sensory exercise to bring you back to the present moment when thoughts are racing.',
      type: 'grounding',
      duration: 3,
      steps: [
        "Look around you and name 5 things you can see (e.g., your pen, your desk, a book).",
        "Acknowledge 4 things you can touch or feel (e.g., the texture of your chair, the cool desk).",
        "Listen closely and name 3 things you can hear (e.g., a fan humming, distant traffic).",
        "Notice 2 things you can smell (e.g., paper, tea).",
        "Notice 1 thing you can taste (e.g., water, mint)."
      ]
    };
  }

  return {
    id: 'mock-2',
    title: 'Box Breathing for Exam Calm',
    description: 'Regulate your nervous system and lower cortisol levels immediately.',
    type: 'breathing',
    duration: 2,
    steps: [
      "Inhale slowly through your nose for 4 seconds.",
      "Hold your breath at the top for 4 seconds.",
      "Exhale gently through your mouth for 4 seconds.",
      "Hold your breath at the bottom for 4 seconds.",
      "Repeat this cycle 4 times."
    ]
  };
}
