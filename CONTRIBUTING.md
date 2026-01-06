# Contributing to VoxScribe

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js >= 18.16.0
- npm >= 9.0.0
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/voxscribe.git
   cd voxscribe
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development:
   ```bash
   npm run dev
   ```

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

- `feat(transcription): add language selection`
- `fix(recording): handle microphone permission error`
- `docs(readme): add installation instructions`

### Code Style

- Run `npm run lint` before committing
- Run `npm run lint:fix` to auto-fix issues
- Follow existing code patterns
- Use TypeScript strict mode

## Pull Request Process

1. Create a feature branch from `main`
2. Make your changes
3. Run tests: `npm test`
4. Run linter: `npm run lint`
5. Update documentation if needed
6. Submit PR with clear description

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Tests pass locally
- [ ] Linter passes
- [ ] Documentation updated (if applicable)
- [ ] CHANGELOG.md updated (for features/fixes)

## Reporting Issues

### Bug Reports

Include:

- OS and version
- Node.js version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/logs if applicable

### Feature Requests

Include:

- Use case description
- Proposed solution (optional)
- Alternatives considered (optional)

## Code of Conduct

Be respectful and inclusive. We follow the [Contributor Covenant](CODE_OF_CONDUCT.md).

## Questions?

Open an issue with the `question` label or start a discussion.

---

Thank you for contributing!
