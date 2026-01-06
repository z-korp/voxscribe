# VoxScribe

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-27-blue.svg)](https://www.electronjs.org/)

> Record meetings, remove silence, transcribe locally with Whisper - 100% offline and private.

## What is VoxScribe?

A desktop application (Windows/macOS/Linux) that:

1. **Records meetings** - Capture system audio (Teams, Zoom, etc.) + microphone
2. **Detects speech segments** - Automatically removes silence using FFmpeg
3. **Transcribes locally** - Uses Whisper (OpenAI) running 100% offline on your machine

## Key Features

- **100% Offline** - Your audio never leaves your computer
- **Smart Chunking** - Detects speech and removes silence automatically
- **Local Transcription** - Whisper models downloaded once, run forever
- **Export Ready** - WAV files (16kHz mono) ready for any STT engine
- **Multi-language** - French & English transcription models

## Quick Start

```bash
# Clone
git clone https://github.com/zkorp/voxscribe.git
cd voxscribe

# Install
npm install

# Run
npm run dev
```

## How It Works

1. **Record** a meeting (or load an existing audio/video file)
2. **Analyze** - The app detects speech segments and removes silence
3. **Transcribe** - Enable Whisper transcription (auto-downloads ~1.5GB model on first use)
4. **Export** - Download WAV chunks or copy transcription

## Requirements

- Node.js 18+
- Windows recommended for system audio capture
- macOS/Linux: UI works, but system audio capture is limited

> **Note:** No system FFmpeg installation required. The app bundles `@ffmpeg-installer/ffmpeg` and `@ffprobe-installer/ffprobe` which auto-detect your platform.

## Installation

### Windows (recommended for meeting recording)

System audio capture (Teams, Zoom, etc.) requires native Windows.

```powershell
git clone https://github.com/zkorp/voxscribe.git
cd voxscribe
npm install
npm run dev
```

### macOS

> **Important:** The app is not signed with an Apple Developer certificate. macOS will show "is damaged and can't be opened".

**To fix this**, open Terminal and run:

```bash
xattr -cr "/Applications/VoxScribe.app"
```

Then open the app normally.

### Linux / WSL

```bash
npm install
npm run dev
```

> **Note:** On WSL, the UI works but Windows system audio capture is not available.

## Build for Distribution

```bash
npm run build          # Build all (main/preload/renderer)
npm run build:win      # Windows (.exe)
npm run build:mac      # macOS (.dmg)
npm run build:linux    # Linux (.AppImage, .deb)
```

Executables are generated in the `release/` folder.

## Available Scripts

| Script                | Description                        |
| --------------------- | ---------------------------------- |
| `npm run dev`         | Start Electron in development mode |
| `npm run build`       | Build for production               |
| `npm run build:win`   | Package for Windows                |
| `npm run build:mac`   | Package for macOS                  |
| `npm run build:linux` | Package for Linux                  |
| `npm run lint`        | Run ESLint                         |
| `npm run test`        | Run Vitest tests                   |

## Usage

### 1. Recording a Meeting

1. Click **"Start recording"**
2. Select the audio source (screen or window of your meeting)
3. Check **"Include microphone"** to capture your voice
4. Click **"Start recording"**
5. Stop when done - the file is saved as `.webm`
6. Click **"Use for analysis"** to proceed to chunking

### 2. Analysis & Chunking

1. **Select a media file** (audio/video or previous recording)
2. **Configure** silence detection: threshold (dB), minimum duration, padding, etc.
3. **Analyze** - FFmpeg detects silences, keeps only speech segments
4. **Results:**
   - Table of segments with timestamps
   - Audio players: "Before cleanup" and "After silence removal"
   - WAV files (mono 16kHz) ready for STT in `*-chunks/`
   - "Download all chunks" button to generate a ZIP archive

## Project Structure

```
src/
├── main/          # Electron main process (window, IPC, FFmpeg chunking)
├── preload/       # Secure bridge exposing IPC to renderer
└── renderer/      # React UI
    ├── components/    # Reusable UI components
    ├── hooks/         # Custom React hooks
    ├── types/         # TypeScript type definitions
    └── utils/         # Utility functions
```

## Generated Files

Files are stored in `appData/voxscribe/`:

- `recordings/` - Meeting recordings (`.webm`)
- `media-previews/` - Analyzed files
  - Full MP3 (original + cleaned)
  - `*-chunks/` folder with mono 16kHz WAV files

## Using Chunks with STT Engines

1. Run analysis to generate WAV files per segment
2. Each file is mono, 16kHz - ready for Whisper or similar
3. Example:
   ```bash
   whisper "chunk-001.wav" --model base
   ```
4. Aggregate transcriptions with `startMs`/`endMs` metadata

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## License

MIT - see [LICENSE](LICENSE)
