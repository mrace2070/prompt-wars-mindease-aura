import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import App from './App';
import '@testing-library/jest-dom';

beforeAll(() => {
  // Mock scrollIntoView which is not implemented by jsdom
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  
  // Mock global fetch to prevent any outbound calls during tests
  globalThis.fetch = vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ candidates: [{ content: { parts: [{ text: "Mock response" }] } }] })
    })
  ) as any;
});

describe('Aura Mental Wellness Tracker - App Component Tests', () => {
  it('renders header with title and exam badge', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /Aura/i })).toBeInTheDocument();
    expect(screen.getByText(/JEE EXAM WELLNESS/i)).toBeInTheDocument();
  });

  it('navigates to different tabs when tab buttons are clicked', () => {
    render(<App />);
    
    // Default tab is dashboard
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'dashboard-tabpanel');
    
    // Navigate to Journal
    const journalTab = screen.getByRole('tab', { name: /Journal & Log/i });
    fireEvent.click(journalTab);
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'journal-tabpanel');
    expect(screen.getByText(/Open-Ended Daily Journal/i)).toBeInTheDocument();
    
    // Navigate to Chat
    const chatTab = screen.getByRole('tab', { name: /Aura Companion/i });
    fireEvent.click(chatTab);
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'chat-tabpanel');
    expect(screen.getByText(/Chat with Aura/i)).toBeInTheDocument();
    
    // Navigate to Mindfulness
    const mindfulnessTab = screen.getByRole('tab', { name: /Mindfulness/i });
    fireEvent.click(mindfulnessTab);
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'mindfulness-tabpanel');
    expect(screen.getByText(/Interactive Box Breathing/i)).toBeInTheDocument();
    
    // Navigate to Settings
    const settingsTab = screen.getByRole('tab', { name: /Settings/i });
    fireEvent.click(settingsTab);
    expect(screen.getByRole('tabpanel')).toHaveAttribute('id', 'settings-tabpanel');
    expect(screen.getByText(/Settings & Data Integrity/i)).toBeInTheDocument();
  });

  it('updates the selected target exam context when exam selectors are clicked', () => {
    render(<App />);
    
    // Click on UPSC exam button
    const upscBtn = screen.getByRole('button', { name: 'UPSC' });
    fireEvent.click(upscBtn);
    
    // Verify badge updates to UPSC
    expect(screen.getByText(/UPSC EXAM WELLNESS/i)).toBeInTheDocument();
  });

  it('toggles interactive breathing guide on and off', () => {
    render(<App />);
    
    // Navigate to mindfulness tab
    const mindfulnessTab = screen.getByRole('tab', { name: /Mindfulness/i });
    fireEvent.click(mindfulnessTab);
    
    const startBtn = screen.getByRole('button', { name: /Start box breathing guide/i });
    expect(startBtn).toBeInTheDocument();
    
    // Toggle start
    fireEvent.click(startBtn);
    expect(screen.getByRole('button', { name: /Stop box breathing guide/i })).toBeInTheDocument();
    
    // Toggle stop
    fireEvent.click(screen.getByRole('button', { name: /Stop box breathing guide/i }));
    expect(screen.getByRole('button', { name: /Start box breathing guide/i })).toBeInTheDocument();
  });

  it('allows user to type daily journal text', () => {
    render(<App />);
    
    // Navigate to journal tab
    const journalTab = screen.getByRole('tab', { name: /Journal & Log/i });
    fireEvent.click(journalTab);
    
    const textarea = screen.getByPlaceholderText(/Write freely/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Physics backlog is giving me sleep issues.' } });
    expect(textarea.value).toBe('Physics backlog is giving me sleep issues.');
  });
});
