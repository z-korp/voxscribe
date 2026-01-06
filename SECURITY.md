# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability in VoxScribe, please report it responsibly.

### How to Report

1. **Do NOT** open a public issue for security vulnerabilities
2. Send an email to: **thomas@zkorp.xyz**
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fixes (optional)

### What to Expect

- **Response time**: Within 48 hours
- **Updates**: We will keep you informed of our progress
- **Credit**: We will credit you in the release notes (unless you prefer anonymity)

### Scope

This policy applies to:

- VoxScribe desktop application
- All code in this repository

### Out of Scope

- Third-party dependencies (report directly to maintainers)
- FFmpeg/Whisper vulnerabilities (report to respective projects)

## Security Features

VoxScribe is designed with privacy and security in mind:

- **100% Offline**: No data leaves your computer
- **Electron Sandbox**: Enabled by default
- **Context Isolation**: Enabled
- **No Node Integration**: In renderer process
- **Local Processing**: All audio/transcription happens locally

Thank you for helping keep VoxScribe secure!
