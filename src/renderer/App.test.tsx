import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import App from './App';

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial Render', () => {
    it('renders the app title', () => {
      render(<App />);
      expect(screen.getByText(/VoxScribe/i)).toBeInTheDocument();
    });

    it('shows no files selected placeholder', () => {
      render(<App />);
      expect(screen.getByText(/No files selected/i)).toBeInTheDocument();
    });

    it('renders the file selection button', () => {
      render(<App />);
      expect(screen.getByText(/Choose files/i)).toBeInTheDocument();
    });

    it('renders the recording section', () => {
      render(<App />);
      expect(screen.getByRole('heading', { name: /Record Meeting/i })).toBeInTheDocument();
    });

    it('renders the settings section', () => {
      render(<App />);
      expect(screen.getByText(/Settings/i)).toBeInTheDocument();
    });

    it('renders the transcription section', () => {
      render(<App />);
      expect(screen.getByRole('heading', { name: /Transcription/i })).toBeInTheDocument();
    });

    it('renders the analysis section', () => {
      render(<App />);
      expect(screen.getByRole('heading', { name: /Analysis/i })).toBeInTheDocument();
    });
  });

  describe('Analysis Controls', () => {
    it('disables analyze button when no files selected', () => {
      render(<App />);
      const analyzeButton = screen.getByRole('button', { name: /Analyze/i });
      expect(analyzeButton).toBeDisabled();
    });

    it('renders start recording button', () => {
      render(<App />);
      expect(screen.getByText(/Start recording/i)).toBeInTheDocument();
    });
  });

  describe('Transcription Settings', () => {
    it('renders transcription toggle', () => {
      render(<App />);
      expect(screen.getByText(/Enable transcription/i)).toBeInTheDocument();
    });

    it('renders language selector', () => {
      render(<App />);
      expect(screen.getByDisplayValue(/Auto-detect/i)).toBeInTheDocument();
    });

    it('has Auto-detect as default language', () => {
      render(<App />);
      const languageSelect = screen.getByDisplayValue(/Auto-detect/i);
      expect(languageSelect).toBeInTheDocument();
    });
  });

  describe('Preset Settings', () => {
    it('renders preset selector', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Preset/i)).toBeInTheDocument();
      });
    });

    it('has Meeting as default preset', async () => {
      render(<App />);

      await waitFor(() => {
        const presetSelect = screen.getByDisplayValue(/Meeting/i);
        expect(presetSelect).toBeInTheDocument();
      });
    });

    it('shows preset description', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Optimized for video calls/i)).toBeInTheDocument();
      });
    });
  });
});
