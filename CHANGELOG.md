# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-04-26

### Added
- Initial release of SismoNetwork
- FastAPI backend with WebSocket sensor ingestion
- Two-layer earthquake detection (threshold + STA/LTA algorithm)
- Global data sync: USGS, EMSC, KOERI, AFAD
- Web dashboard with Leaflet map
- Android app (Expo SDK 54, Material You design)
  - 4 tabs: Alerts / Earthquake List / Report / Settings+Chat
  - Live accelerometer streaming via WebSocket
  - GPS-based automatic region detection
  - MMI felt report (Mercalli scale II-VII)
  - Real-time chat with profanity filter and flood protection
- REST API endpoints: /status, /devices, /events, /alerts, /report
- Manual earthquake report submission via /report endpoint
- GitHub Actions CI workflow
- MIT License
- Community files: CONTRIBUTING.md, SECURITY.md, issue templates

### Notes
- Tested with Expo Go on Android devices
- Standalone APK build planned for v0.2.0
- Windows desktop app planned for future release

## [Unreleased]

### Planned
- Standalone APK via EAS Build
- Windows desktop app (Electron + Fluent UI)
- Multi-device management panel
- Country-based chat rooms
- Additional data sources (INGV, GFZ)
- iOS support
