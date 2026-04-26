# SismoNetwork — Phone-Based Earthquake Early Warning System

An open-source distributed earthquake detection network that analyzes real-time accelerometer data from Android phones, cross-references it with global seismic data (USGS, EMSC, KOERI, AFAD), and sends early warnings before official confirmation.

> 📱 **Android app:** Testable via Expo Go — standalone APK coming soon  
> 🖥️ **Windows app:** Planned (Electron + Fluent UI)

---

## Features

### Backend
- ✅ **Real-time sensor ingestion** — multi-device WebSocket support
- ✅ **Two-layer earthquake detection** — simple threshold + STA/LTA algorithm
- ✅ **Geofencing** — 50 km radius clustering + region ID grouping
- ✅ **Global data sources** — USGS, EMSC, KOERI, AFAD integration
- ✅ **Smart matching** — correlates local sensor triggers with official data
- ✅ **Early warning** — alerts sent before official confirmation
- ✅ **REST API + WebSocket** — devices, events, alerts, live sensor summary
- ✅ **Web dashboard** — Leaflet map, live device list, earthquake feed
- ✅ **Chat** — real-time messaging over WebSocket (flood protection included)
- ✅ **Manual reports** — `/report` endpoint for felt-earthquake reports (MMI scale)

### Android App
- ✅ **Material You theme** — adapts to system color palette (Android 12+)
- ✅ **4 tabs:** Alerts / Earthquake List / Report / Settings + Chat
- ✅ **Live sensor monitoring** — accelerometer data streamed to server
- ✅ **GPS region detection** — automatic `region_id` from location
- ✅ **Earthquake list** — source filter, magnitude color scale, distance from user
- ✅ **MMI felt report** — Mercalli scale II–VII manual report submission
- ✅ **Alert customization** — minimum magnitude threshold, distance filter, notification types
- ✅ **Chat** — real-time messaging, profanity filter, flood protection (3 msg/10s)

---

## Architecture

```
seismic-network/
├── main.py                    # FastAPI server, WebSocket manager, REST API
├── analysis.py                # STA/LTA signal processing, geofencing
├── models.py                  # SQLAlchemy database models
├── global_sync.py             # USGS + EMSC sync
├── koeri_sync.py              # KOERI (Kandilli Observatory) sync
├── afad_sync.py               # AFAD sync
├── config.py                  # Configuration
└── android-app/
    ├── App.tsx                # Tab navigation + Material You theme
    ├── context/
    │   └── SeismicContext.tsx # WebSocket, sensor, chat, settings state
    └── screens/
        ├── AlertsScreen.tsx   # Alerts + network status + live sensor
        ├── QuakeListScreen.tsx# Global earthquake list
        ├── ReportScreen.tsx   # MMI felt report
        └── SettingsScreen.tsx # Settings + chat
```

---

## Requirements

### Backend
- Python 3.9+
- Ubuntu 22.04+ (VPS recommended)

### Android App
- Node.js 18+
- Expo Go app (for testing)

---

## Setup

### Backend

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Android App

```bash
cd android-app
npm install
npx expo start --lan
```

Scan the QR code with Expo Go.

---

## API Reference

### WebSocket

```
wss://YOUR_SERVER/ws/sensor/{device_id}
```

**Send sensor data:**
```json
{
  "type": "sensor_data",
  "x": 0.05, "y": 0.03, "z": 9.81,
  "latitude": 41.0082, "longitude": 28.9784,
  "region_id": "turkey_istanbul",
  "timestamp": "2024-03-19T20:00:00Z"
}
```

**Send chat message:**
```json
{ "type": "chat", "text": "Hello!", "timestamp": "..." }
```

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Network status, device count |
| GET | `/devices` | Registered devices |
| GET | `/events` | Local + global earthquake events |
| GET | `/alerts` | Generated alerts |
| POST | `/report` | Submit a felt-earthquake report |

---

## Detection Logic

### Two-Layer Detection

| Layer | Method | Threshold |
|-------|--------|-----------|
| 1 | Simple threshold | vector magnitude > 0.1g |
| 2 | STA/LTA | ratio > 3.0 (STA: 1s, LTA: 30s) |

### Geofencing Rules

- Time window: 5 seconds
- Minimum devices: 3+
- Radius: 50 km (Haversine)

### Alert Decision Matrix

| Local Sensors | Official Data | Result |
|---------------|---------------|--------|
| ✅ Triggered | ❌ No data yet | **EARLY WARNING** (orange) |
| ✅ Triggered | ✅ Matched | **CONFIRMED EARTHQUAKE** (red) |
| ❌ Silent | ✅ Official data | **DISTANT EARTHQUAKE** (blue) |

---

## Configuration

Edit `config.py`:

```python
THRESHOLD_SIMPLE_G = 0.1          # Simple threshold (g)
STA_LTA_TRIGGER_RATIO = 3.0       # STA/LTA trigger ratio
GEOFENCING_RADIUS_KM = 50.0       # Clustering radius
TIME_WINDOW_SECONDS = 5           # Detection time window
MIN_DEVICES_FOR_TRIGGER = 3       # Minimum devices to confirm event
```

---

## Roadmap

- [ ] Standalone APK / EAS Build
- [ ] Windows desktop app (Electron + Fluent UI)
- [ ] Multi-device management panel
- [ ] Country-based chat rooms
- [ ] Additional data sources (INGV, GFZ)
- [ ] iOS support

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes
4. Push and open a Pull Request

---

> ⚠️ This system is not a replacement for official earthquake warning services. It is intended for early alerting and community awareness only.
