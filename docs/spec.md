# Call Center Audio Capture – Specification

## Objectifs
- Capturer simultanément l’audio micro (flux A) et l’audio système (flux B) sur une machine desktop.
- Centraliser les flux pour analyse en temps réel, enregistrement et intégrations (transcription, routage call center).
- Garantir la conformité (consentement et sécurité) et la robustesse (reconnexion devices, monitoring).

## Portée Fonctionnelle
- **Device Mirroring** : Gestion des périphériques audio natifs + configuration d’un périphérique virtuel selon l’OS (WASAPI loopback, BlackHole, PipeWire monitor).
- **Routing Audio** : Exposer deux flux PCM distincts vers un bus interne, avec horodatage, métadonnées (source, latence estimée), et latence max configurable.
- **UI Monitoring** : Application Electron avec interface React affichant l’état de capture, vu-mètres, alertes d’erreur ou perte de device.
- **API IPC** : Fournir au renderer et à des modules externes des hooks pour consommer les flux (stream Node, WebRTC, enregistrement).
- **Enregistrement Local** : Start/Stop, choix des flux (A/B/both), export WAV/FLAC, métadonnées session (timestamps, consentement).
- **Consentement** : Pop-up initial, stockage sécurisé de l’acceptation, possibilité de retrait → arrêt automatique des captures.
- **Resilience** : Auto-reconnexion en cas de perte device, watchdog débit audio, fallback mono si stéréo indisponible, logs centralisés.

## Architecture Logique
- **Electron Main Process**
  - Permissions & enumeration devices.
  - Module `audio-pipeline` (bindings natifs) créant deux `Readable` streams Node.
  - IPC sécurisée (`contextBridge`) pour exposer les flux et événements.

- **Electron Renderer (React)**
  - UI monitoring (vu-mètres, états).
  - Store global (Zustand/Recoil) pour état devices, consentement, erreurs.
  - Actions d’enregistrement et configuration utilisateur.

- **Services Node**
  - `audio-hub` : centralise flux A/B, normalisation, timestamps.
  - `recorder` : agrège flux, encode WAV/FLAC, gère stockage.
  - `transcript-adapter` : interface pour brancher un moteur (Whisper, API tierce).

- **Sécurité/Compliance**
  - Keytar pour stockage tokens.
  - Journalisation consentements.
  - Config runtime restreinte (CSP, sécu IPC).

## Découpage des Tâches & Tests Progressifs

1. **Bootstrap Electron/React**
   - Scaffolding (`electron-vite` ou `electron-forge`), TypeScript, ESLint, Vitest.
   - Tests : smoke test Vitest sur rendu App + ping IPC mock.

2. **Device Enumeration & Permissions**
   - Module `device-service`, UI liste devices, bouton “Grant access”.
   - Tests : mocks devices, vérification erreurs (device introuvable, permission refusée).

3. **Capture Micro (Flux A)**
   - Implémentation stream micro via module natif (node-core-audio / binding Rust).
   - Tests : unit test wrapper (émission chunks simulés), test intégration enregistrement 5 s → fichier WAV non vide.

4. **Capture Sortie Système (Flux B)**
   - Gestion driver virtuel, configuration OS, loopback pipeline.
   - Tests : pipeline test avec audio synthétique (sinus) → FFT basique pour valider contenu.

5. **Flux Manager & API IPC**
   - Module `audio-hub` gérant streams, métadonnées, latence.
   - Tests : unit test sur latence (diff < seuil), test IPC (renderer reçoit events & buffers).

6. **UI Monitoring & Alertes**
   - Composants React vu-mètre (WebAudio analyser), états (capturing/paused/error).
   - Tests : React Testing Library (transitions d’état), mocks analyser pour vérifier affichage jauges.

7. **Enregistrement Local**
   - Module `recorder` (A/B/both) avec export WAV/FLAC, métadonnées session.
   - Tests : e2e headless (Playwright + Electron) start/stop → fichier existant + JSON session.

8. **Intégration Transcription (Optionnel MVP)**
   - Interface `TranscriptAdapter`, implémentation mock (Whisper local).
   - Tests : unit test handshake (chunks → appels adapter), mock temps de réponse.

9. **Consentement & Sécurité**
   - Pop-up consentement, stockage, retrait; intégration Keytar.
   - Tests : unit tests store consentement, e2e accept/refus.

10. **Résilience & QA Finale**
    - Watchers device (déconnexion → UI warning, retry), logging (Winston).
    - Tests : scénario e2e device unplug (mock), test endurance (stream 1 h en CI → check mémoire/handles).

## Hypothèses & Pré-requis
- Application desktop ciblant Windows/macOS/Linux (adapter instructions drivers virtuels par OS).
- L’utilisateur installe manuellement le driver virtuel recommandé (documentation fournie).
- Pas d’accès réseau par défaut (intégration transcription externe nécessite configuration explicite).
- Politique de consentement conforme, définie par l’équipe légale.

## Deliverables
- Code base Electron/React/Node (TypeScript).
- Documentation installation drivers + configuration.
- Suite tests : unitaires (Vitest), composants UI, e2e (Playwright).
- Scripts `npm run test`, `npm run e2e`, `npm run build`.
- Guide conformité (consentement, stockage données).
