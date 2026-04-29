from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Request, Header
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Dict, Optional, Set
import json
import logging
import asyncio
import time
from collections import defaultdict, deque
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

banned_devices: Set[str] = set()
chat_history: deque = deque(maxlen=200)
ws_message_times: Dict[str, deque] = defaultdict(lambda: deque(maxlen=config.WS_RATE_LIMIT_PER_SECOND))

def require_admin(x_admin_key: Optional[str] = Header(None)):
    if x_admin_key != config.ADMIN_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
    return True

def ws_rate_ok(device_id: str) -> bool:
    now = time.monotonic()
    times = ws_message_times[device_id]
    times.append(now)
    one_sec_ago = now - 1.0
    recent = [t for t in times if t > one_sec_ago]
    ws_message_times[device_id] = deque(recent, maxlen=config.WS_RATE_LIMIT_PER_SECOND)
    return len(recent) <= config.WS_RATE_LIMIT_PER_SECOND

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
    if device_id in banned_devices:
        await websocket.close(code=4003, reason="Device banned")
        return
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
                raw = await websocket.receive_text()
                if len(raw) > config.WS_MAX_MESSAGE_BYTES:
                    continue
                if not ws_rate_ok(device_id):
                    logger.warning(f"Rate limit exceeded: {device_id}")
                    continue
                if device_id in banned_devices:
                    await websocket.close(code=4003, reason="Device banned")
                    break
                data = json.loads(raw)
                
                if data.get('type') == 'chat':
                    msg = {
                        'type': 'chat',
                        'device_id': device_id,
                        'text': str(data.get('text', ''))[:300],
                        'timestamp': data.get('timestamp', datetime.utcnow().isoformat()),
                        'id': f"{device_id}_{int(time.time()*1000)}",
                    }
                    chat_history.append(msg)
                    await manager.broadcast(msg)
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
    return """<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>SismoNetwork Admin</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{--bg:#07101f;--surface:#0d1b2e;--card:#111f35;--border:#1a2f4a;--text:#e2e8f0;--text2:#94a3b8;--text3:#4a6080;--accent:#3b82f6;--red:#ef4444;--orange:#f97316;--green:#22c55e;--yellow:#eab308}
body{font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);min-height:100vh;font-size:14px}

/* LOGIN */
#login-overlay{position:fixed;inset:0;background:#07101fef;display:flex;align-items:center;justify-content:center;z-index:9999}
.login-box{background:var(--card);border:1px solid var(--border);border-radius:20px;padding:36px 32px;width:340px;display:flex;flex-direction:column;gap:16px}
.login-box h2{font-size:20px;font-weight:700}
.login-box p{color:var(--text2);font-size:13px}
.login-box input{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:10px 14px;color:var(--text);font-size:14px;width:100%;outline:none}
.login-box input:focus{border-color:var(--accent)}
.login-box button{background:var(--accent);color:#fff;border:none;border-radius:10px;padding:11px;font-size:14px;font-weight:600;cursor:pointer}
.login-err{color:var(--red);font-size:12px;display:none}

/* LAYOUT */
.topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;background:var(--surface);border-bottom:1px solid var(--border);position:sticky;top:0;z-index:100}
.topbar-left{display:flex;align-items:center;gap:10px}
.topbar-logo{width:32px;height:32px;background:var(--red);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px}
.topbar h1{font-size:16px;font-weight:700}
.live-badge{display:flex;align-items:center;gap:6px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);border-radius:999px;padding:4px 10px;font-size:12px;color:var(--green)}
.dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
.tabs{display:flex;gap:4px;padding:0 24px;background:var(--surface);border-bottom:1px solid var(--border)}
.tab{padding:10px 16px;cursor:pointer;color:var(--text2);font-size:13px;font-weight:500;border-bottom:2px solid transparent;transition:all .15s}
.tab.active{color:var(--text);border-bottom-color:var(--accent)}
.tab-content{display:none;padding:20px 24px}
.tab-content.active{display:block}

/* STATS */
.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px}
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:16px}
.stat-label{font-size:11px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.stat-val{font-size:28px;font-weight:800}
.stat-sub{font-size:11px;color:var(--text3);margin-top:4px}

/* GRID */
.grid2{display:grid;grid-template-columns:1.5fr 1fr;gap:16px}
.grid3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
@media(max-width:900px){.grid2,.grid3{grid-template-columns:1fr}}
.panel{background:var(--card);border:1px solid var(--border);border-radius:14px;overflow:hidden}
.panel-head{padding:12px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.panel-head h3{font-size:14px;font-weight:600}
.panel-body{padding:12px;max-height:420px;overflow-y:auto}

/* MAP */
#map{height:460px;border-radius:0}

/* ITEMS */
.item{border-radius:10px;padding:10px 12px;background:var(--surface);border-left:3px solid var(--accent);margin-bottom:8px;font-size:13px}
.item:last-child{margin-bottom:0}
.item-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.item-title{font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.item-meta{font-size:11px;color:var(--text2);margin-top:3px}
.badge-pill{display:inline-block;border-radius:6px;padding:2px 7px;font-size:11px;font-weight:600}
.empty{color:var(--text3);text-align:center;padding:24px;font-size:13px}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:6px;border:none;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;transition:opacity .15s}
.btn:hover{opacity:.8}
.btn-sm{padding:3px 8px;font-size:11px;border-radius:6px}
.btn-red{background:rgba(239,68,68,.15);color:var(--red);border:1px solid rgba(239,68,68,.3)}
.btn-orange{background:rgba(249,115,22,.15);color:var(--orange);border:1px solid rgba(249,115,22,.3)}
.btn-green{background:rgba(34,197,94,.15);color:var(--green);border:1px solid rgba(34,197,94,.3)}
.btn-blue{background:rgba(59,130,246,.15);color:var(--accent);border:1px solid rgba(59,130,246,.3)}

/* CHAT */
.chat-wrap{display:flex;flex-direction:column;height:460px}
.chat-msgs{flex:1;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px}
.chat-msg{background:var(--surface);border-radius:10px;padding:8px 12px;font-size:13px}
.chat-msg-head{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.chat-device{font-size:11px;font-weight:700;color:var(--accent)}
.chat-time{font-size:10px;color:var(--text3);margin-left:auto}
.chat-text{color:var(--text)}
.chat-del{background:none;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:0 4px;opacity:0;transition:opacity .15s}
.chat-msg:hover .chat-del{opacity:1}
.chat-msg.deleted{opacity:.3;text-decoration:line-through}
.chat-input-row{display:flex;gap:8px;padding:12px;border-top:1px solid var(--border)}
.chat-input-row input{flex:1;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;color:var(--text);font-size:13px;outline:none}

/* NOTIFY */
#toast{position:fixed;bottom:24px;right:24px;background:#1e293b;border:1px solid var(--border);border-radius:12px;padding:12px 18px;font-size:13px;z-index:9998;opacity:0;transition:opacity .3s;pointer-events:none}
#toast.show{opacity:1}
</style>
</head>
<body>

<div id="login-overlay">
  <div class="login-box">
    <div style="font-size:28px">🌍</div>
    <h2>SismoNetwork Admin</h2>
    <p>Yönetim paneline erişmek için admin anahtarını girin.</p>
    <input id="key-input" type="password" placeholder="Admin anahtarı..." />
    <div class="login-err" id="login-err">Hatalı anahtar. Tekrar deneyin.</div>
    <button onclick="doLogin()">Giriş Yap</button>
  </div>
</div>

<div id="app" style="display:none">
  <div class="topbar">
    <div class="topbar-left">
      <div class="topbar-logo">🌐</div>
      <h1>SismoNetwork Admin</h1>
    </div>
    <div class="live-badge"><span class="dot"></span><span id="ws-count">0 bağlantı</span></div>
  </div>
  <div class="tabs">
    <div class="tab active" onclick="switchTab('overview')">Genel Bakış</div>
    <div class="tab" onclick="switchTab('devices')">Cihazlar</div>
    <div class="tab" onclick="switchTab('alerts')">Uyarılar</div>
    <div class="tab" onclick="switchTab('chat')">Sohbet</div>
    <div class="tab" onclick="switchTab('events')">Olaylar</div>
  </div>

  <!-- OVERVIEW -->
  <div class="tab-content active" id="tab-overview">
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">Aktif Cihaz</div><div class="stat-val" id="s-devices">—</div></div>
      <div class="stat-card"><div class="stat-label">WS Bağlantısı</div><div class="stat-val" id="s-ws">—</div></div>
      <div class="stat-card"><div class="stat-label">Aktif Uyarı</div><div class="stat-val" id="s-alerts" style="color:var(--red)">—</div></div>
      <div class="stat-card"><div class="stat-label">Canlı Sarsıntı</div><div class="stat-val" id="s-motion">—</div></div>
      <div class="stat-card"><div class="stat-label">Son Örnek</div><div class="stat-val" id="s-age" style="font-size:20px">—</div></div>
    </div>
    <div class="grid2">
      <div class="panel">
        <div class="panel-head"><h3>Canlı Harita</h3></div>
        <div id="map"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Son Uyarılar</h3></div>
        <div class="panel-body" id="ov-alerts"></div>
      </div>
    </div>
  </div>

  <!-- DEVICES -->
  <div class="tab-content" id="tab-devices">
    <div class="panel">
      <div class="panel-head">
        <h3>Bağlı &amp; Kayıtlı Cihazlar</h3>
        <span id="banned-count" class="badge-pill" style="background:rgba(239,68,68,.1);color:var(--red)"></span>
      </div>
      <div class="panel-body" style="max-height:none" id="dev-list"></div>
    </div>
  </div>

  <!-- ALERTS -->
  <div class="tab-content" id="tab-alerts">
    <div class="panel">
      <div class="panel-head"><h3>Tüm Uyarılar</h3></div>
      <div class="panel-body" style="max-height:none" id="all-alerts"></div>
    </div>
  </div>

  <!-- CHAT -->
  <div class="tab-content" id="tab-chat">
    <div class="panel">
      <div class="panel-head">
        <h3>Sohbet Moderasyonu</h3>
        <button class="btn btn-red btn-sm" onclick="clearAllChat()">Tümünü Temizle</button>
      </div>
      <div class="chat-wrap">
        <div class="chat-msgs" id="chat-msgs"></div>
        <div class="chat-input-row">
          <input id="chat-in" placeholder="Admin olarak mesaj gönder..." onkeydown="if(event.key==='Enter')sendAdminChat()" />
          <button class="btn btn-blue" onclick="sendAdminChat()">Gönder</button>
        </div>
      </div>
    </div>
  </div>

  <!-- EVENTS -->
  <div class="tab-content" id="tab-events">
    <div class="grid2">
      <div class="panel">
        <div class="panel-head"><h3>Yerel Olaylar</h3></div>
        <div class="panel-body" style="max-height:none" id="local-events"></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3>Global Depremler</h3></div>
        <div class="panel-body" style="max-height:none" id="global-events"></div>
      </div>
    </div>
  </div>
</div>

<div id="toast"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
let ADMIN_KEY = '';
let map, deviceMarkers=[], eventMarkers=[];
let bannedDevices = new Set();
let chatWs = null;
let currentTab = 'overview';

function doLogin() {
  const key = document.getElementById('key-input').value.trim();
  if (!key) return;
  fetch('/admin/ban', {headers:{'x-admin-key':key}})
    .then(r => {
      if (r.ok) {
        ADMIN_KEY = key;
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app').style.display = 'block';
        initApp();
      } else {
        document.getElementById('login-err').style.display = 'block';
      }
    }).catch(() => { document.getElementById('login-err').style.display = 'block'; });
}
document.getElementById('key-input').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

function switchTab(name) {
  currentTab = name;
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', ['overview','devices','alerts','chat','events'][i]===name));
  document.querySelectorAll('.tab-content').forEach(tc => tc.classList.toggle('active', tc.id === 'tab-'+name));
  if (name === 'chat') loadChat();
}

function adminFetch(url, opts={}) {
  opts.headers = {...(opts.headers||{}), 'x-admin-key': ADMIN_KEY};
  return fetch(url, opts);
}

function toast(msg, color='#22c55e') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = color;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return m + ' dk önce';
  const h = Math.floor(m/60);
  if (h < 24) return h + ' sa önce';
  return Math.floor(h/24) + ' gün önce';
}

function magColor(m) {
  if (m >= 6) return '#ef4444';
  if (m >= 4) return '#f97316';
  if (m >= 2) return '#eab308';
  return '#22c55e';
}

// MAP
function initMap() {
  map = L.map('map').setView([39, 35], 5);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {maxZoom:18,attribution:'&copy; OSM &copy; CARTO'}).addTo(map);
}

function updateMap(devices, events, live) {
  deviceMarkers.forEach(m => map.removeLayer(m)); deviceMarkers = [];
  eventMarkers.forEach(m => map.removeLayer(m)); eventMarkers = [];
  (devices||[]).forEach(d => {
    if (d.last_latitude == null) return;
    const lv = (live.devices||[]).find(x => x.device_id===d.id);
    const mag = Number(lv?.magnitude||0);
    const c = mag>=2.2?'#ef4444':mag>=1.3?'#f97316':d.is_active?'#22c55e':'#64748b';
    const m = L.circleMarker([d.last_latitude,d.last_longitude],{radius:Math.max(7,Math.min(20,7+mag*4)),fillColor:c,color:'#fff',weight:1,fillOpacity:.85})
      .bindPopup(`<b>${d.id}</b><br>${d.region_id||'—'}<br>M: ${mag.toFixed(3)}`).addTo(map);
    deviceMarkers.push(m);
  });
  (events.global_events||[]).forEach(ev => {
    const m = L.circleMarker([ev.latitude,ev.longitude],{radius:6,fillColor:magColor(ev.magnitude),color:'#fff',weight:1,fillOpacity:.8})
      .bindPopup(`<b>M${ev.magnitude}</b> ${ev.place||'—'}<br>${ev.source}`).addTo(map);
    eventMarkers.push(m);
  });
}

// LOAD
async function loadOverview() {
  try {
    const [status, devices, alerts, events, live] = await Promise.all([
      fetch('/status').then(r=>r.json()),
      fetch('/devices?active_only=false').then(r=>r.json()),
      fetch('/alerts?active_only=false&limit=15').then(r=>r.json()),
      fetch('/events?event_type=all&limit=20').then(r=>r.json()),
      fetch('/live-sensor-summary').then(r=>r.json()),
    ]);
    document.getElementById('s-devices').textContent = status.active_devices;
    document.getElementById('s-ws').textContent = status.websocket_connections;
    document.getElementById('s-alerts').textContent = status.active_alerts;
    document.getElementById('s-motion').textContent = Number(live.max_magnitude||0).toFixed(3);
    document.getElementById('s-age').textContent = live.latest_sample_age_seconds != null ? live.latest_sample_age_seconds+'s' : '—';
    document.getElementById('ws-count').textContent = `${status.websocket_connections} bağlantı`;
    updateMap(devices, events, live);
    const ovA = document.getElementById('ov-alerts');
    if (!alerts.length) { ovA.innerHTML = '<div class="empty">Aktif uyarı yok ✓</div>'; }
    else ovA.innerHTML = alerts.map(a => `
      <div class="item" style="border-left-color:${a.color||'#3b82f6'}">
        <div class="item-row">
          <span class="item-title">${a.alert_type}</span>
          <span class="badge-pill" style="background:${a.is_active?'rgba(239,68,68,.15)':'rgba(100,116,139,.15)'}; color:${a.is_active?'var(--red)':'var(--text2)'}">${a.is_active?'Aktif':'Çözümlendi'}</span>
          ${a.is_active ? `<button class="btn btn-green btn-sm" onclick="resolveAlert(${a.id})">Çöz</button>` : ''}
        </div>
        <div class="item-meta">${a.message}</div>
        <div class="item-meta">${timeAgo(a.timestamp)}</div>
      </div>`).join('');
  } catch(e) { console.error(e); }
}

async function loadDevices() {
  const [devices, live, banned] = await Promise.all([
    fetch('/devices?active_only=false').then(r=>r.json()),
    fetch('/live-sensor-summary').then(r=>r.json()),
    adminFetch('/admin/ban').then(r=>r.json()),
  ]);
  bannedDevices = new Set(banned.banned_devices||[]);
  document.getElementById('banned-count').textContent = bannedDevices.size ? `${bannedDevices.size} yasaklı` : '';
  const el = document.getElementById('dev-list');
  if (!devices.length) { el.innerHTML = '<div class="empty">Kayıtlı cihaz yok</div>'; return; }
  el.innerHTML = devices.map(d => {
    const lv = (live.devices||[]).find(x=>x.device_id===d.id);
    const mag = Number(lv?.magnitude||0);
    const isBanned = bannedDevices.has(d.id);
    return `<div class="item" style="border-left-color:${isBanned?'var(--red)':d.is_active?'var(--green)':'var(--text3)'}">
      <div class="item-row">
        <span class="item-title" style="${isBanned?'text-decoration:line-through;color:var(--red)':''}">${d.id}</span>
        <span class="badge-pill" style="background:${d.is_active?'rgba(34,197,94,.1)':'rgba(100,116,139,.1)'};color:${d.is_active?'var(--green)':'var(--text2)'}">${d.is_active?'Aktif':'Pasif'}</span>
        ${isBanned ? `<button class="btn btn-green btn-sm" onclick="unbanDevice('${d.id}')">Yasağı Kaldır</button>` :
          `<button class="btn btn-orange btn-sm" onclick="kickDevice('${d.id}')">Kick</button>
           <button class="btn btn-red btn-sm" onclick="banDevice('${d.id}')">Ban</button>`}
      </div>
      <div class="item-meta">${d.region_id||'Bölge yok'} · M: ${mag.toFixed(3)} · ${d.last_latitude!=null?d.last_latitude.toFixed(4)+', '+d.last_longitude.toFixed(4):'Konum yok'}</div>
      <div class="item-meta">Son: ${timeAgo(d.last_seen)}</div>
    </div>`;
  }).join('');
}

async function loadAllAlerts() {
  const alerts = await fetch('/alerts?active_only=false&limit=100').then(r=>r.json());
  const el = document.getElementById('all-alerts');
  if (!alerts.length) { el.innerHTML = '<div class="empty">Uyarı yok</div>'; return; }
  el.innerHTML = alerts.map(a => `
    <div class="item" style="border-left-color:${a.color||'#3b82f6'}">
      <div class="item-row">
        <span class="item-title">${a.alert_type}</span>
        <span class="badge-pill" style="background:${a.is_active?'rgba(239,68,68,.15)':'rgba(100,116,139,.15)'};color:${a.is_active?'var(--red)':'var(--text2)'}">${a.priority}</span>
        ${a.is_active?`<button class="btn btn-green btn-sm" onclick="resolveAlert(${a.id})">Çöz</button>`:''}
      </div>
      <div class="item-meta">${a.message}</div>
      <div class="item-meta">${new Date(a.timestamp).toLocaleString('tr-TR')}</div>
    </div>`).join('');
}

async function loadChat() {
  const data = await adminFetch('/admin/chat?limit=100').then(r=>r.json());
  const el = document.getElementById('chat-msgs');
  el.innerHTML = '';
  (data.messages||[]).forEach(m => appendChatMsg(m));
  el.scrollTop = el.scrollHeight;
  if (!chatWs) connectChatWs();
}

async function loadEvents() {
  const events = await fetch('/events?event_type=all&limit=50').then(r=>r.json());
  const le = document.getElementById('local-events');
  const ge = document.getElementById('global-events');
  const local = events.local_events||[];
  const global = events.global_events||[];
  le.innerHTML = !local.length ? '<div class="empty">Yerel olay yok</div>' :
    local.map(e=>`<div class="item" style="border-left-color:var(--yellow)">
      <div class="item-row"><span class="item-title">${e.region||'Bilinmiyor'}</span><span class="badge-pill" style="background:rgba(234,179,8,.1);color:var(--yellow)">${e.status}</span></div>
      <div class="item-meta">${e.device_count} cihaz · Avg M ${Number(e.avg_magnitude||0).toFixed(2)} · Max M ${Number(e.max_magnitude||0).toFixed(2)}</div>
      <div class="item-meta">${timeAgo(e.timestamp)}</div>
    </div>`).join('');
  ge.innerHTML = !global.length ? '<div class="empty">Global deprem yok</div>' :
    global.map(e=>`<div class="item" style="border-left-color:${magColor(e.magnitude)}">
      <div class="item-row"><span class="item-title">${e.place||'Bilinmiyor'}</span><span class="badge-pill" style="background:${magColor(e.magnitude)}22;color:${magColor(e.magnitude)}">M${e.magnitude}</span></div>
      <div class="item-meta">${e.source} · ${Math.abs(e.depth_km||0).toFixed(0)} km derinlik</div>
      <div class="item-meta">${timeAgo(e.timestamp)}</div>
    </div>`).join('');
}

// ACTIONS
async function resolveAlert(id) {
  await adminFetch(`/alerts/${id}/resolve`,{method:'POST'});
  toast('Uyarı çözümlendi');
  if (currentTab==='alerts') loadAllAlerts(); else loadOverview();
}

async function banDevice(id) {
  if (!confirm(`${id} cihazını ban'la?`)) return;
  await adminFetch(`/admin/ban/${id}`,{method:'POST'});
  toast(`${id} yasaklandı`, '#ef4444');
  loadDevices();
}

async function unbanDevice(id) {
  await adminFetch(`/admin/ban/${id}`,{method:'DELETE'});
  toast(`${id} yasağı kaldırıldı`);
  loadDevices();
}

async function kickDevice(id) {
  await adminFetch(`/admin/kick/${id}`,{method:'POST'});
  toast(`${id} kicked`,'#f97316');
  loadDevices();
}

async function deleteMsg(msgId, el) {
  await adminFetch(`/admin/chat/${msgId}`,{method:'DELETE'});
  el.classList.add('deleted');
  toast('Mesaj silindi','#f97316');
}

async function clearAllChat() {
  if (!confirm('Tüm chat geçmişi silinsin mi?')) return;
  const data = await adminFetch('/admin/chat?limit=200').then(r=>r.json());
  await Promise.all((data.messages||[]).map(m => adminFetch(`/admin/chat/${m.id}`,{method:'DELETE'})));
  document.getElementById('chat-msgs').innerHTML = '';
  toast('Chat temizlendi','#f97316');
}

function appendChatMsg(m) {
  const el = document.getElementById('chat-msgs');
  const div = document.createElement('div');
  div.className = 'chat-msg';
  div.id = 'msg-'+m.id;
  div.innerHTML = `
    <div class="chat-msg-head">
      <span class="chat-device">${m.device_id}</span>
      <span class="chat-time">${timeAgo(m.timestamp)}</span>
      <button class="chat-del" onclick="deleteMsg('${m.id}',this.closest('.chat-msg'))" title="Sil">🗑</button>
    </div>
    <div class="chat-text">${m.text.replace(/</g,'&lt;')}</div>`;
  el.appendChild(div);
}

function connectChatWs() {
  const wsUrl = location.protocol==='https:'?'wss://'+location.host:'ws://'+location.host;
  chatWs = new WebSocket(wsUrl+'/ws/sensor/admin_dashboard');
  chatWs.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.type==='chat' && currentTab==='chat') {
      appendChatMsg(msg);
      const el = document.getElementById('chat-msgs');
      el.scrollTop = el.scrollHeight;
    }
    if (msg.type==='chat_delete') {
      const target = document.getElementById('msg-'+msg.message_id);
      if (target) target.classList.add('deleted');
    }
  };
  chatWs.onclose = () => { chatWs=null; setTimeout(connectChatWs, 3000); };
}

function sendAdminChat() {
  const inp = document.getElementById('chat-in');
  const text = inp.value.trim();
  if (!text || !chatWs || chatWs.readyState!==1) return;
  chatWs.send(JSON.stringify({type:'chat',text:'[ADMIN] '+text,timestamp:new Date().toISOString()}));
  inp.value = '';
}

// INIT
function initApp() {
  initMap();
  loadOverview();
  setInterval(() => {
    if (currentTab==='overview') loadOverview();
    if (currentTab==='devices') loadDevices();
    if (currentTab==='alerts') loadAllAlerts();
    if (currentTab==='events') loadEvents();
  }, 5000);
  document.querySelectorAll('.tab').forEach((t,i) => {
    t.addEventListener('click', () => {
      const names = ['overview','devices','alerts','chat','events'];
      if (names[i]==='devices') loadDevices();
      if (names[i]==='alerts') loadAllAlerts();
      if (names[i]==='events') loadEvents();
    });
  });
}
</script>
</body>
</html>"""

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

@app.get("/admin/chat", dependencies=[Depends(require_admin)])
async def get_chat_history(limit: int = 100):
    msgs = list(chat_history)[-limit:]
    return {"messages": msgs, "total": len(chat_history)}

@app.delete("/admin/chat/{message_id}", dependencies=[Depends(require_admin)])
async def delete_chat_message(message_id: str):
    before = len(chat_history)
    remaining = [m for m in chat_history if m.get("id") != message_id]
    chat_history.clear()
    chat_history.extend(remaining)
    deleted = before - len(chat_history)
    await manager.broadcast({"type": "chat_delete", "message_id": message_id})
    return {"deleted": deleted, "message_id": message_id}

@app.post("/admin/ban/{device_id}", dependencies=[Depends(require_admin)])
async def ban_device(device_id: str):
    banned_devices.add(device_id)
    if device_id in manager.active_connections:
        try:
            await manager.active_connections[device_id].close(code=4003, reason="Banned by admin")
        except Exception:
            pass
        manager.disconnect(device_id)
    logger.warning(f"Device banned by admin: {device_id}")
    return {"banned": device_id}

@app.delete("/admin/ban/{device_id}", dependencies=[Depends(require_admin)])
async def unban_device(device_id: str):
    banned_devices.discard(device_id)
    return {"unbanned": device_id}

@app.get("/admin/ban", dependencies=[Depends(require_admin)])
async def list_banned():
    return {"banned_devices": list(banned_devices)}

@app.post("/admin/kick/{device_id}", dependencies=[Depends(require_admin)])
async def kick_device(device_id: str):
    if device_id in manager.active_connections:
        try:
            await manager.active_connections[device_id].close(code=4000, reason="Kicked by admin")
        except Exception:
            pass
        manager.disconnect(device_id)
        return {"kicked": device_id}
    return {"detail": "Device not connected"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=config.HOST,
        port=config.PORT,
        reload=True,
        log_level=config.LOG_LEVEL.lower()
    )
