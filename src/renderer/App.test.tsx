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
      expect(screen.getByText(/Aucun fichier selectionne/i)).toBeInTheDocument();
    });

    it('renders the file selection button', () => {
      render(<App />);
      expect(screen.getByText(/Choisir des fichiers/i)).toBeInTheDocument();
    });

    it('renders the recording section', () => {
      render(<App />);
      expect(screen.getByText(/Enregistrement Meeting/i)).toBeInTheDocument();
    });

    it('renders the parameters section', () => {
      render(<App />);
      expect(screen.getByText(/Parametres/i)).toBeInTheDocument();
    });

    it('renders the transcription section', () => {
      render(<App />);
      expect(screen.getByRole('heading', { name: /Transcription Whisper/i })).toBeInTheDocument();
    });

    it('renders the analysis section', () => {
      render(<App />);
      expect(screen.getByRole('heading', { name: /Analyse/i })).toBeInTheDocument();
    });
  });

  describe('Analysis Controls', () => {
    it('disables analyze button when no files selected', () => {
      render(<App />);
      const analyzeButton = screen.getByRole('button', { name: /Analyser/i });
      expect(analyzeButton).toBeDisabled();
    });

    it('renders start recording button', () => {
      render(<App />);
      expect(screen.getByText(/Demarrer un enregistrement/i)).toBeInTheDocument();
    });
  });

  describe('Transcription Settings', () => {
    it('renders transcription toggle', () => {
      render(<App />);
      expect(screen.getByText(/Activer la transcription Whisper/i)).toBeInTheDocument();
    });

    it('renders language selector', () => {
      render(<App />);
      expect(screen.getByText(/Langue/i)).toBeInTheDocument();
    });

    it('has French as default language option', () => {
      render(<App />);
      const languageSelect = screen.getByDisplayValue(/Francais/i);
      expect(languageSelect).toBeInTheDocument();
    });

    it('renders word detail toggle', () => {
      render(<App />);
      expect(screen.getByText(/Inclure le detail par mot/i)).toBeInTheDocument();
    });
  });

  describe('Parameter Options', () => {
    it('loads default analysis options', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Seuil de silence/i)).toBeInTheDocument();
      });
    });

    it('renders silence threshold option', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Seuil de silence \(dB\)/i)).toBeInTheDocument();
      });
    });

    it('renders minimum silence duration option', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Duree minimale du silence/i)).toBeInTheDocument();
      });
    });

    it('renders padding options', async () => {
      render(<App />);

      await waitFor(() => {
        expect(screen.getByText(/Marge avant/i)).toBeInTheDocument();
        expect(screen.getByText(/Marge apres/i)).toBeInTheDocument();
      });
    });
  });
});
