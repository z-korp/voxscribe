# VoxScribe

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-green.svg)](https://nodejs.org/)
[![Electron](https://img.shields.io/badge/Electron-27-blue.svg)](https://www.electronjs.org/)

> Record meetings, remove silence, transcribe locally with Whisper - 100% offline and private.

---

**[English](#english)** | **[Francais](#francais)**

---

## English

### What is VoxScribe?

A desktop application (Windows/macOS/Linux) that:

1. **Records meetings** - Capture system audio (Teams, Zoom, etc.) + microphone
2. **Detects speech segments** - Automatically removes silence using FFmpeg
3. **Transcribes locally** - Uses Whisper (OpenAI) running 100% offline on your machine

### Key Features

- **100% Offline** - Your audio never leaves your computer
- **Smart Chunking** - Detects speech and removes silence automatically
- **Local Transcription** - Whisper models downloaded once, run forever
- **Export Ready** - WAV files (16kHz mono) ready for any STT engine
- **Multi-language** - French & English transcription models

### Quick Start

```bash
# Clone
git clone https://github.com/zkorp/voxscribe.git
cd voxscribe

# Install
npm install

# Run
npm run dev
```

### How It Works

1. **Record** a meeting (or load an existing audio/video file)
2. **Analyze** - The app detects speech segments and removes silence
3. **Transcribe** - Enable Whisper transcription (auto-downloads ~1.5GB model on first use)
4. **Export** - Download WAV chunks or copy transcription

### Requirements

- Node.js 18+
- Windows recommended for system audio capture
- macOS/Linux: UI works, but system audio capture is limited

### Installation (macOS)

> **macOS users**: The app is not signed with an Apple Developer certificate. macOS will show "is damaged and can't be opened".

**To fix this**, open Terminal and run:

```bash
xattr -cr "/Applications/VoxScribe.app"
```

Then open the app normally.

### Build for Distribution

```bash
npm run build:win    # Windows (.exe)
npm run build:mac    # macOS (.dmg)
npm run build:linux  # Linux (.AppImage, .deb)
```

---

## Francais

Application Electron pour :

- **Enregistrer des meetings** (capture audio systeme + microphone)
- **Decouper automatiquement** des enregistrements audio/video en segments parles
- **Transcrire localement** avec Whisper (100% offline)

## Prerequis

- Node.js 18+ (npm ou pnpm)
- Aucune installation systeme de ffmpeg n'est requise : l'application embarque
  `@ffmpeg-installer/ffmpeg` et `@ffprobe-installer/ffprobe` qui detectent automatiquement
  votre plateforme (Windows, macOS, Linux) et telechargent les binaires appropries.

## Installation

### Windows (recommande pour l'enregistrement de meetings)

L'enregistrement audio systeme (Teams, Zoom, etc.) necessite Windows natif.

```powershell
# Cloner ou copier le projet
git clone https://github.com/zkorp/voxscribe.git
cd voxscribe

# Installer les dependances
npm install

# Lancer en mode dev
npm run dev
```

### macOS

> **Important** : L'application n'est pas signee avec un certificat Apple Developer. macOS affichera "est endommage et ne peut pas etre ouvert".

**Solution** : Ouvrez le Terminal et executez :

```bash
xattr -cr "/Applications/VoxScribe.app"
```

Puis ouvrez l'application normalement.

### Linux / WSL

```bash
npm install
npm run dev
```

> **Note :** Sur WSL, l'interface s'affiche mais la capture audio systeme Windows n'est pas disponible.

## Build pour distribution

```bash
# Build les fichiers (main/preload/renderer)
npm run build

# Packager pour Windows (depuis Windows)
npm run build:win

# Packager pour Linux
npm run build:linux

# Packager pour macOS
npm run build:mac
```

Les executables sont generes dans le dossier `release/`.

## Scripts Disponibles

- `npm run dev` : Electron (main + renderer) en mode developpement
- `npm run build` : builds production (main/preload/renderer)
- `npm run build:win` : package l'application pour Windows
- `npm run build:linux` : package l'application pour Linux
- `npm run build:mac` : package l'application pour macOS
- `npm run preview` : previsualise le bundle production
- `npm run lint` : ESLint sur l'ensemble du projet
- `npm run test` : tests Vitest cote renderer

## Fonctionnalites

### 1. Enregistrement de Meeting

1. Cliquez sur **"Demarrer un enregistrement"**
2. Selectionnez la source audio (ecran ou fenetre de votre meeting)
3. Cochez **"Inclure le microphone"** pour capturer votre voix
4. Cliquez **"Lancer l'enregistrement"**
5. Arretez quand vous voulez -> le fichier est sauvegarde en `.webm`
6. Cliquez **"Utiliser pour l'analyse"** pour passer au decoupage

### 2. Analyse et decoupage

1. **Selection d'un media** (audio/video ou enregistrement precedent)
2. **Configuration** des parametres de silence : seuil (dB), duree minimale, padding, etc.
3. **Analyse** : `ffmpeg` detecte les silences, puis seuls les segments parles sont conserves
4. **Resultats** :
   - Tableau des segments avec timestamps
   - Lecteurs MP3 "Avant nettoyage" et "Apres suppression du silence"
   - Fichiers WAV mono 16 kHz prets pour STT dans `*-chunks/`
   - Bouton "Telecharger tous les chunks" pour generer une archive ZIP

## Structure

- `src/main` : process principal Electron (fenetre, IPC, chunking via ffmpeg, enregistrement)
- `src/preload` : bridge securise exposant l'IPC au renderer
- `src/renderer` : UI React (enregistrement, selection, parametres, resultats)

## Fichiers generes

Les fichiers sont stockes dans `appData/voxscribe/` :

- `recordings/` : enregistrements de meetings (`.webm`)
- `media-previews/` : fichiers analyses
  - MP3 complets (original + sans silences)
  - Dossier `*-chunks/` contenant les WAV mono 16 kHz

## Utiliser les chunks pour un moteur STT

1. Lancez l'analyse pour generer les WAV par segment
2. Chaque fichier est mono, 16 kHz, pret pour Whisper ou equivalent
3. Exemple :

   ```bash
   whisper "chunk-001.wav" --model base
   ```

4. Agregez les transcriptions avec les metadonnees `startMs`/`endMs`

## Transcription Vosk (optionnel)

Pour activer la transcription offline avec Vosk :

1. Ajoutez `vosk` aux dependances : `npm install vosk`
2. Telechargez un modele Vosk (ex: `vosk-model-small-fr-0.22`)
3. Activez dans l'interface et indiquez le chemin du modele

> **Note :** Vosk necessite la compilation de modules natifs (Windows SDK + Visual Studio Build Tools).

## Notes

- Pour reinitialiser le cache, supprimez `media-previews/` dans `appData`
- L'analyse repose sur ffmpeg/ffprobe embarques automatiquement

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT - see [LICENSE](LICENSE)
