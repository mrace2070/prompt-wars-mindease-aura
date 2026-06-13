import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeJournalEntry, getCompanionResponse, generateMindfulnessExercise, checkApiKeyValidity } from './gemini';

// Mock global fetch
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('Gemini Client Wrapper Tests', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('checkApiKeyValidity', () => {
    it('should return isValid = true if fetch returns ok', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });
      const result = await checkApiKeyValidity();
      expect(result.isValid).toBe(true);
    });

    it('should return isValid = false if fetch returns error status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ error: { message: 'Invalid API key' } })
      });
      const result = await checkApiKeyValidity();
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('API Error (400)');
    });
  });

  describe('analyzeJournalEntry', () => {
    it('should parse and return structured journal analysis on success', async () => {
      const mockAnalysis = {
        sentiment: "Highly focused",
        dominantEmotions: ["Focus"],
        stressLevel: 3,
        hiddenTriggers: ["None"],
        copingStrategies: ["Keep going"],
        cognitiveDistortions: [],
        personalizedEncouragement: "Great job!"
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify(mockAnalysis) }]
            }
          }]
        })
      });

      const result = await analyzeJournalEntry('I feel good', 'good', 'JEE');
      expect(result.sentiment).toBe("Highly focused");
      expect(result.stressLevel).toBe(3);
      expect(result.dominantEmotions).toContain("Focus");
    });

    it('should fall back to mock analysis if fetch fails or throws error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));
      const result = await analyzeJournalEntry('I feel bad', 'anxious', 'JEE');
      expect(result.stressLevel).toBe(8); // Anxious mood fallback is 8
      expect(result.dominantEmotions).toContain('Anxiety');
    });
  });

  describe('getCompanionResponse', () => {
    it('should return companion message text on success', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: "Hello! I am Aura." }]
            }
          }]
        })
      });

      const result = await getCompanionResponse([], [], 'JEE');
      expect(result).toBe("Hello! I am Aura.");
    });

    it('should return fallback message if fetch fails or throws error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('API Error'));
      const result = await getCompanionResponse([], [], 'JEE');
      expect(result).toContain("standing by you");
      expect(result).toContain("deep breath");
    });
  });

  describe('generateMindfulnessExercise', () => {
    it('should return mindfulness exercise steps on success', async () => {
      const mockExercise = {
        title: "Mindful Breathing",
        description: "Calm breathing exercise",
        type: "breathing",
        duration: 3,
        steps: ["Step 1", "Step 2"]
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: JSON.stringify(mockExercise) }]
            }
          }]
        })
      });

      const result = await generateMindfulnessExercise('neutral', [], 'JEE');
      expect(result.title).toBe("Mindful Breathing");
      expect(result.steps).toContain("Step 1");
    });

    it('should fall back to mock exercise if fetch fails or throws error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Fetch error'));
      const result = await generateMindfulnessExercise('anxious', [], 'JEE');
      expect(result.title).toContain("5-4-3-2-1 Technique"); // Anxious mood fallback is grounding 5-4-3-2-1
    });
  });
});
