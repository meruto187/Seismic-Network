from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Optional
import json
import logging
import asyncio
from contextlib import asynccontextmanager

from config import config
from models import (
    init_db, get_db, Device, SensorData, LocalEvent, 
    GlobalEvent, Alert, SessionLocal
)
from analysis import (
    signal_processor, geofence_analyzer, event_matcher
)
from global_sync import global_sync
from koeri_sync import KOERISync
from afad_sync import AFADSync

logging.basicConfig(level=config.LOG_LEVEL)
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, device_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[device_id] = websocket
        logger.info(f"Device {device_id} connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, device_id: str):
        if device_id in self.active_connections:
            del self.active_connections[device_id]
            logger.info(f"Device {device_id} disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        disconnected = []
        for device_id, connection in self.active_connections.items():
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to {device_id}: {e}")
                disconnected.append(device_id)
        
        for device_id in disconnected:
            self.disconnect(device_id)

manager = ConnectionManager()

koeri_sync = KOERISync()
afad_sync = AFADSync()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Seismic Network Server...")
    init_db()
    await global_sync.start()
    asyncio.create_task(koeri_sync.sync_loop())
    asyncio.create_task(afad_sync.sync_loop())
    asyncio.create_task(event_detection_loop())
    yield
    await global_sync.stop()
    koeri_sync.stop()
    afad_sync.stop()
    logger.info("Shutting down Seismic Network Server...")

app = FastAPI(
    title="Seismic Network API",
    description="Merkezi Sismik Ağ - Telefon İvmeölçer Tabanlı Deprem Tespit Sistemi",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

async def event_detection_loop():
    while True:
        try:
            await asyncio.sleep(1)
            
            events = geofence_analyzer.find_clustered_events()
            
            if events:
                db = SessionLocal()
                try:
                    for event_data in events:
                        existing = db.query(LocalEvent).filter(
                            LocalEvent.id == event_data['id']
                        ).first()
                        
                        if not existing:
                            local_event = LocalEvent(**event_data)
                            db.add(local_event)
                            db.commit()
                            db.refresh(local_event)
                            
                            global_event = event_matcher.match_local_with_global(local_event, db)
                            
                            alert = event_matcher.create_alert(local_event, global_event, db)
                            
                            await manager.broadcast({
                                'type': 'alert',
                                'alert_type': alert.alert_type,
                                'message': alert.message,
                                'priority': alert.priority,
                                'color': alert.color,
                                'timestamp': alert.timestamp.isoformat(),
                                'local_event': {
                                    'id': local_event.id,
                                    'device_count': local_event.device_count,
                                    'avg_magnitude': local_event.avg_magnitude,
                                    'region': local_event.region
                                }
                            })
                            
                            logger.info(f"Alert created: {alert.alert_type} - {alert.message}")
                
                finally:
                    db.close()
        
        except Exception as e:
            logger.error(f"Error in event detection loop: {e}")

@app.websocket("/ws/sensor/{device_id}")
async def websocket_endpoint(websocket: WebSocket, device_id: str):
    await manager.connect(device_id, websocket)
    
    db = SessionLocal()
    try:
        device = db.query(Device).filter(Device.id == device_id).first()
        if not device:
            device = Device(id=device_id)
            db.add(device)
            db.commit()
        else:
            device.last_seen = datetime.utcnow()
            device.is_active = True
            db.commit()
        
        while True:
            try:
                data = await websocket.receive_json()
                
                if data.get('type') == 'chat':
                    await manager.broadcast({
                        'type': 'chat',
                        'device_id': device_id,
                        'text': str(data.get('text', ''))[:300],
                        'timestamp': data.get('timestamp', datetime.utcnow().isoformat()),
                    })
                    continue
                
                timestamp = datetime.fromisoformat(data['timestamp']) if 'timestamp' in data else datetime.utcnow()
                x = float(data['x'])
                y = float(data['y'])
                z = float(data['z'])
                latitude = float(data.get('latitude')) if data.get('latitude') else None
                longitude = float(data.get('longitude')) if data.get('longitude') else None
                region_id = data.get('region_id')
                
                magnitude, sta_lta_ratio, simple_triggered, sta_lta_triggered = signal_processor.process_sensor_data({
                    'device_id': device_id,
                    'timestamp': timestamp,
                    'x': x,
                    'y': y,
                    'z': z
                })
                
                sensor_data = SensorData(
                    device_id=device_id,
                    timestamp=timestamp,
                    x=x,
                    y=y,
                    z=z,
                    latitude=latitude,
                    longitude=longitude,
                    region_id=region_id,
                    magnitude=magnitude,
                    sta_lta_ratio=sta_lta_ratio
                )
                db.add(sensor_data)
                
                if latitude and longitude:
                    device.last_latitude = latitude
                    device.last_longitude = longitude
                if region_id:
                    device.region_id = region_id
                device.last_seen = datetime.utcnow()
                
                db.commit()
                
                if simple_triggered or sta_lta_triggered:
                    detection_method = []
                    if simple_triggered:
                        detection_method.append("simple_threshold")
                    if sta_lta_triggered:
                        detection_method.append("sta_lta")
                    
                    geofence_analyzer.add_trigger(
                        device_id=device_id,
                        timestamp=timestamp,
                        latitude=latitude,
                        longitude=longitude,
                        region_id=region_id,
                        magnitude=magnitude,
                        detection_method=', '.join(detection_method)
                    )
                    
                    logger.info(f"Trigger detected from {device_id}: magnitude={magnitude:.3f}, sta_lta={sta_lta_ratio:.2f}")
                
                await websocket.send_json({
                    'status': 'ok',
                    'magnitude': magnitude,
                    'sta_lta_ratio': sta_lta_ratio,
                    'triggered': simple_triggered or sta_lta_triggered
                })
                
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Error processing data from {device_id}: {e}")
                await websocket.send_json({'status': 'error', 'message': str(e)})
    
    finally:
        manager.disconnect(device_id)
        device = db.query(Device).filter(Device.id == device_id).first()
        if device:
            device.is_active = False
            db.commit()
        db.close()

@app.post("/report")
async def submit_report(request: Request):
    try:
        data = await request.json()
        logger.info(f"Manual report from {data.get('device_id')}: MMI={data.get('mmi')} lat={data.get('latitude')} lon={data.get('longitude')}")
        return {"status": "ok", "message": "Rapor alındı"}
    except Exception as e:
        logger.error(f"Report error: {e}")
        return {"status": "error"}

@app.get("/")
async def root():
    return RedirectResponse(url="/dashboard", status_code=307)

@app.get("/api")
async def api_root():
    return {
        "service": "Seismic Network API",
        "version": "1.0.0",
        "status": "running"
    }

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard():
    return """
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SismoNetwork Panel</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #081226; color: #e2e8f0; }
    .shell { padding: 20px; display: grid; gap: 16px; }
    .hero { background: linear-gradient(135deg, #0f172a, #172554); border: 1px solid #1e293b; border-radius: 20px; padding: 20px; }
    .hero h1 { margin: 0 0 8px; font-size: 28px; }
    .hero p { margin: 0; color: #cbd5e1; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 18px; padding: 16px; }
    .metric { font-size: 30px; font-weight: 700; margin-top: 10px; }
    .label { color: #93c5fd; font-size: 13px; }
    .grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 16px; }
    #map { height: 520px; width: 100%; border-radius: 18px; }
    .panel-title { margin: 0 0 12px; font-size: 18px; }
    .list { display: grid; gap: 10px; max-height: 520px; overflow: auto; }
    .item { background: #111c33; border-radius: 14px; padding: 12px; border-left: 4px solid #2563eb; }
    .item strong { display: block; margin-bottom: 6px; }
    .muted { color: #94a3b8; font-size: 13px; }
    .badge { display: inline-flex; align-items: center; gap: 8px; background: #111827; border: 1px solid #334155; border-radius: 999px; padding: 8px 12px; margin-top: 14px; }
    .dot { width: 10px; height: 10px; border-radius: 999px; background: #22c55e; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } #map { height: 380px; } }
  </style>
</head>
<body>
  <div class="shell">
    <section class="hero">
      <h1>SismoNetwork Kontrol Paneli</h1>
      <p>Telefonlardan gelen sensör akışı, aktif cihazlar, yerel olaylar ve uyarılar tek panelde izlenir.</p>
      <div class="badge"><span class="dot"></span><span id="connection-state">Canlı veri paneli hazır</span></div>
    </section>
    <section class="stats">
      <div class="card"><div class="label">Aktif Cihaz</div><div class="metric" id="active-devices">0</div></div>
      <div class="card"><div class="label">Canlı Sarsıntı</div><div class="metric" id="live-motion">0.000</div></div>
      <div class="card"><div class="label">Aktif Uyarı</div><div class="metric" id="alert-count">0</div></div>
      <div class="card"><div class="label">Son Güncelleme</div><div class="metric" id="latest-sample-age">-</div></div>
    </section>
    <section class="grid">
      <div class="card">
        <h2 class="panel-title">Harita</h2>
        <div id="map"></div>
      </div>
      <div class="card">
        <h2 class="panel-title">Son Uyarılar</h2>
        <div class="list" id="alerts-list"></div>
      </div>
    </section>
    <section class="grid">
      <div class="card">
        <h2 class="panel-title">Bağlı Cihazlar</h2>
        <div class="list" id="devices-list"></div>
      </div>
      <div class="card">
        <h2 class="panel-title">Yerel / Global Olaylar</h2>
        <div class="list" id="events-list"></div>
      </div>
    </section>
  </div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    const map = L.map('map').setView([39.0, 35.0], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(map);

    let deviceMarkers = [];
    let eventMarkers = [];

    function clearMarkers(markers) {
      markers.forEach(marker => map.removeLayer(marker));
      markers.length = 0;
    }

    function renderList(elementId, items, renderItem) {
      const el = document.getElementById(elementId);
      if (!items.length) {
        el.innerHTML = '<div class="muted">Henüz veri yok</div>';
        return;
      }
      el.innerHTML = items.map(renderItem).join('');
    }

    async function loadDashboard() {
      const [status, devices, alerts, events, live] = await Promise.all([
        fetch('/status').then(r => r.json()),
        fetch('/devices?active_only=false').then(r => r.json()),
        fetch('/alerts?active_only=false&limit=10').then(r => r.json()),
        fetch('/events?event_type=all&limit=10').then(r => r.json()),
        fetch('/live-sensor-summary').then(r => r.json()),
      ]);

      document.getElementById('active-devices').textContent = status.active_devices;
      document.getElementById('live-motion').textContent = Number(live.max_magnitude || 0).toFixed(3);
      document.getElementById('alert-count').textContent = status.active_alerts;
      document.getElementById('latest-sample-age').textContent = live.latest_sample_age_seconds == null ? '-' : `${live.latest_sample_age_seconds}s`;
      document.getElementById('connection-state').textContent = `${status.websocket_connections} websocket bağlantısı aktif`;

      clearMarkers(deviceMarkers);
      clearMarkers(eventMarkers);

      const bounds = [];
      devices.forEach(device => {
        const liveDevice = (live.devices || []).find(item => item.device_id === device.id);
        if (device.last_latitude != null && device.last_longitude != null) {
          const magnitude = Number(liveDevice?.magnitude || 0);
          const markerColor = magnitude >= 2.2 ? '#ef4444' : magnitude >= 1.3 ? '#f59e0b' : device.is_active ? '#22c55e' : '#94a3b8';
          const markerRadius = Math.max(8, Math.min(22, 8 + magnitude * 5));
          const marker = L.circleMarker([device.last_latitude, device.last_longitude], {
            radius: markerRadius,
            color: markerColor,
            fillOpacity: 0.8,
          }).addTo(map).bindPopup(`<strong>${device.id}</strong><br/>${device.region_id || 'Bölge yok'}<br/>Canlı büyüklük: ${magnitude.toFixed(3)}`);
          deviceMarkers.push(marker);
          bounds.push([device.last_latitude, device.last_longitude]);
        }
      });

      (events.local_events || []).forEach(event => {
        if (event.center_lat != null && event.center_lon != null) {
          const marker = L.circle([event.center_lat, event.center_lon], {
            radius: 15000,
            color: '#f59e0b',
            fillColor: '#f59e0b',
            fillOpacity: 0.18,
          }).addTo(map).bindPopup(`<strong>${event.status}</strong><br/>${event.region || 'Bölge bilinmiyor'}<br/>Cihaz: ${event.device_count}`);
          eventMarkers.push(marker);
          bounds.push([event.center_lat, event.center_lon]);
        }
      });

      (events.global_events || []).forEach(event => {
        const marker = L.circleMarker([event.latitude, event.longitude], {
          radius: 7,
          color: '#ef4444',
          fillOpacity: 0.85,
        }).addTo(map).bindPopup(`<strong>${event.source}</strong><br/>M ${event.magnitude} - ${event.place || 'Konum yok'}`);
        eventMarkers.push(marker);
        bounds.push([event.latitude, event.longitude]);
      });

      if (bounds.length) {
        map.fitBounds(bounds, { padding: [30, 30] });
      }

      renderList('alerts-list', alerts, alert => `
        <div class="item" style="border-left-color:${alert.color || '#2563eb'}">
          <strong>${alert.alert_type}</strong>
          <div>${alert.message}</div>
          <div class="muted">${new Date(alert.timestamp).toLocaleString('tr-TR')}</div>
        </div>
      `);

      renderList('devices-list', devices, device => `
        <div class="item" style="border-left-color:${device.is_active ? '#22c55e' : '#64748b'}">
          <strong>${device.id}</strong>
          <div>${device.region_id || 'Bölge atanmadı'}</div>
          <div class="muted">Canlı büyüklük: ${Number(((live.devices || []).find(item => item.device_id === device.id) || {}).magnitude || 0).toFixed(3)}</div>
          <div class="muted">${device.last_latitude != null ? `${device.last_latitude.toFixed(5)}, ${device.last_longitude.toFixed(5)}` : 'Konum yok'}</div>
        </div>
      `);

      const mixedEvents = [
        ...(events.local_events || []).map(event => ({ ...event, source_label: 'Yerel' })),
        ...(events.global_events || []).map(event => ({ ...event, source_label: event.source })),
      ].slice(0, 12);

      renderList('events-list', mixedEvents, event => `
        <div class="item" style="border-left-color:${event.source_label === 'Yerel' ? '#f59e0b' : '#ef4444'}">
          <strong>${event.source_label}</strong>
          <div>${event.place || event.region || 'Konum yok'}</div>
          <div class="muted">${event.magnitude ? `M ${event.magnitude}` : `Cihaz ${event.device_count || 0}`}</div>
        </div>
      `);
    }

    loadDashboard();
    setInterval(loadDashboard, 5000);
  </script>
</body>
</html>
    """

@app.get("/status")
async def get_status(db: Session = Depends(get_db)):
    active_devices = db.query(Device).filter(Device.is_active == True).count()
    total_devices = db.query(Device).count()
    total_sensor_data = db.query(SensorData).count()
    active_alerts = db.query(Alert).filter(Alert.is_active == True).count()
    local_events = db.query(LocalEvent).count()
    global_events = db.query(GlobalEvent).count()
    
    return {
        "active_devices": active_devices,
        "total_devices": total_devices,
        "total_sensor_data": total_sensor_data,
        "active_alerts": active_alerts,
        "local_events": local_events,
        "global_events": global_events,
        "websocket_connections": len(manager.active_connections)
    }

@app.get("/live-sensor-summary")
async def get_live_sensor_summary(db: Session = Depends(get_db)):
    recent_window_seconds = 120
    recent_cutoff = datetime.utcnow()
    devices = db.query(Device).all()
    devices_summary = []
    max_magnitude = 0.0
    latest_timestamp = None

    for device in devices:
        latest_sample = db.query(SensorData).filter(SensorData.device_id == device.id).order_by(SensorData.timestamp.desc()).first()
        if not latest_sample:
            continue

        sample_age_seconds = int((recent_cutoff - latest_sample.timestamp).total_seconds())
        magnitude = latest_sample.magnitude or 0.0
        max_magnitude = max(max_magnitude, magnitude)
        if latest_timestamp is None or latest_sample.timestamp > latest_timestamp:
            latest_timestamp = latest_sample.timestamp

        devices_summary.append({
            "device_id": device.id,
            "timestamp": latest_sample.timestamp.isoformat(),
            "sample_age_seconds": sample_age_seconds,
            "is_recent": sample_age_seconds <= recent_window_seconds,
            "magnitude": magnitude,
            "sta_lta_ratio": latest_sample.sta_lta_ratio,
            "latitude": latest_sample.latitude,
            "longitude": latest_sample.longitude,
        })

    latest_sample_age_seconds = None
    if latest_timestamp is not None:
        latest_sample_age_seconds = int((datetime.utcnow() - latest_timestamp).total_seconds())

    return {
        "device_count": len(devices_summary),
        "max_magnitude": max_magnitude,
        "latest_sample_age_seconds": latest_sample_age_seconds,
        "devices": devices_summary,
    }

@app.get("/alerts")
async def get_alerts(
    active_only: bool = True,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(Alert)
    
    if active_only:
        query = query.filter(Alert.is_active == True)
    
    alerts = query.order_by(Alert.timestamp.desc()).limit(limit).all()
    
    result = []
    for alert in alerts:
        alert_dict = {
            "id": alert.id,
            "timestamp": alert.timestamp.isoformat(),
            "alert_type": alert.alert_type,
            "message": alert.message,
            "priority": alert.priority,
            "color": alert.color,
            "is_active": alert.is_active
        }
        
        if alert.local_event:
            alert_dict["local_event"] = {
                "id": alert.local_event.id,
                "device_count": alert.local_event.device_count,
                "avg_magnitude": alert.local_event.avg_magnitude,
                "region": alert.local_event.region
            }
        
        if alert.global_event:
            alert_dict["global_event"] = {
                "id": alert.global_event.id,
                "magnitude": alert.global_event.magnitude,
                "place": alert.global_event.place,
                "source": alert.global_event.source
            }
        
        result.append(alert_dict)
    
    return result

@app.get("/devices")
async def get_devices(
    active_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(Device)
    
    if active_only:
        query = query.filter(Device.is_active == True)
    
    devices = query.all()
    
    return [
        {
            "id": device.id,
            "first_seen": device.first_seen.isoformat(),
            "last_seen": device.last_seen.isoformat(),
            "region_id": device.region_id,
            "last_latitude": device.last_latitude,
            "last_longitude": device.last_longitude,
            "is_active": device.is_active
        }
        for device in devices
    ]

@app.get("/events")
async def get_events(
    event_type: str = "all",
    limit: int = 50,
    db: Session = Depends(get_db)
):
    result = {}
    
    if event_type in ["all", "local"]:
        local_events = db.query(LocalEvent).order_by(LocalEvent.timestamp.desc()).limit(limit).all()
        result["local_events"] = [
            {
                "id": event.id,
                "timestamp": event.timestamp.isoformat(),
                "region": event.region,
                "center_lat": event.center_lat,
                "center_lon": event.center_lon,
                "device_count": event.device_count,
                "avg_magnitude": event.avg_magnitude,
                "max_magnitude": event.max_magnitude,
                "status": event.status,
                "detection_method": event.detection_method
            }
            for event in local_events
        ]
    
    if event_type in ["all", "global"]:
        global_events = db.query(GlobalEvent).order_by(GlobalEvent.timestamp.desc()).limit(limit).all()
        result["global_events"] = [
            {
                "id": event.id,
                "source": event.source,
                "timestamp": event.timestamp.isoformat(),
                "latitude": event.latitude,
                "longitude": event.longitude,
                "depth_km": event.depth_km,
                "magnitude": event.magnitude,
                "magnitude_type": event.magnitude_type,
                "place": event.place,
                "url": event.url
            }
            for event in global_events
        ]
    
    return result

@app.post("/alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.is_active = False
    alert.resolved_at = datetime.utcnow()
    db.commit()
    
    return {"status": "resolved", "alert_id": alert_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
        log_level=config.LOG_LEVEL.lower()
    )
