# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024-01-04

### Added

- **Whisper Speech-to-Text**: Local transcription using whisper.cpp via @remotion/install-whisper-cpp
  - Automatic download of whisper.cpp binaries on first use
  - Support for French (medium) and English (medium.en) models
  - Language selector in UI (French/English/Auto-detect)
- **Meeting Recording**: Capture system audio and microphone
  - Desktop/window source selection with thumbnails
  - Mixed audio recording (system + microphone)
  - WebM/Opus format output
- **Audio Analysis & Chunking**
  - Silence detection using FFmpeg
  - Automatic audio segmentation based on speech
  - Configurable silence threshold and duration
  - Padding before/after speech segments
- **Audio Preview**
  - Before/after comparison (original vs cleaned)
  - Per-chunk audio playback
- **Export Features**
  - WAV export (mono 16kHz, optimized for STT)
  - ZIP download of all chunks
  - Copy path / open file actions

### Technical

- Cross-platform support (Windows, macOS, Linux)
- Embedded FFmpeg/FFprobe binaries
- Electron 27 with sandbox enabled
- React 18 + TypeScript + Vite

### Security

- Context isolation enabled
- Sandbox enabled
- No node integration in renderer

## [0.0.1] - 2024-01-01

### Added

- Initial project setup
- Basic Electron scaffold
- Audio file selection
- FFmpeg integration for silence detection

---

[Unreleased]: https://github.com/zkorp/voxscribe/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/zkorp/voxscribe/releases/tag/v0.1.0
[0.0.1]: https://github.com/zkorp/voxscribe/releases/tag/v0.0.1
