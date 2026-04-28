# Contributing to SismoNetwork

Thank you for your interest in contributing!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/Seismic-Network.git`
3. Create a feature branch: `git checkout -b feature/your-feature`

## Backend (Python)

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

- Follow PEP 8 style
- Add docstrings to new functions
- Test your changes with `test_client.py`

## Android App (React Native / Expo)

```bash
cd android-app
npm install
npx expo start --lan
```

- Use TypeScript for all new files
- Keep components in `screens/`, shared state in `context/`
- Test on a physical Android device or emulator via Expo Go

## Submitting a Pull Request

1. Make sure your branch is up to date with `main`
2. Write a clear PR description — what changed and why
3. Reference any related issues with `Fixes #123`

## Reporting Bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) issue template.

## Feature Requests

Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) issue template.
