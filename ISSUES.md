# Issues to create on GitHub

After transferring the repo to zkorp/voxscribe, create these issues:

---

## Issue 1: Batch processing queue

**Title:** feat: Batch processing queue for multiple recordings

**Labels:** enhancement

**Body:**
Add a queue system to process multiple recordings sequentially or in parallel.

### Features

- Upload multiple files at once
- Progress indicator per file
- Overall progress bar
- Ability to cancel individual items or entire queue
- Resume failed items

---

## Issue 2: Video clip export

**Title:** feat: Export video clips synced with audio segments

**Labels:** enhancement

**Body:**
Currently the app exports audio chunks. Add the ability to export video clips that match the detected speech segments.

### Features

- Keep video in sync with audio segments
- Export individual video clips per segment
- Option to export a single concatenated video without silences
- Support common formats (MP4, WebM)

---

## Issue 3: Duration statistics

**Title:** feat: Duration statistics visualization

**Labels:** enhancement

**Body:**
Add visual statistics showing how much content was kept vs removed.

### Features

- Pie chart or bar showing kept vs removed duration
- Percentage of silence removed
- Total time saved
- Export stats to JSON/CSV

---

## Issue 4: Real-time VU meters

**Title:** feat: Real-time audio monitoring with VU meters

**Labels:** enhancement

**Body:**
Add real-time audio level visualization during recording.

### Features

- VU meter for system audio
- VU meter for microphone (when enabled)
- Peak level indicators
- Clipping warnings

---

## Issue 5: End-to-end tests

**Title:** test: Add Playwright E2E tests

**Labels:** testing

**Body:**
Add end-to-end tests using Playwright to test the full application flow.

### Test scenarios

- File selection and analysis
- Recording flow (mock audio)
- Settings persistence
- Export functionality
- Error handling

---

## Issue 6: Consent management

**Title:** feat: Consent management system

**Labels:** enhancement, privacy

**Body:**
Add a consent management system for recording meetings ethically.

### Features

- Consent prompt before recording
- Option to notify participants
- Consent log/audit trail
- Legal disclaimer templates
