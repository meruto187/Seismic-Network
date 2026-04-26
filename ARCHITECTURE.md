# Sistem Mimarisi

## Genel Bakış

```
┌─────────────────┐
│  Mobil Cihazlar │ (Telefonlar)
│  (İvmeölçerler) │
└────────┬────────┘
         │ WebSocket
         │ (x, y, z, lat, lon)
         ▼
┌─────────────────────────────────────────────────────┐
│              FastAPI Sunucusu (main.py)             │
│  ┌───────────────────────────────────────────────┐  │
│  │     WebSocket Manager (ConnectionManager)     │  │
│  └───────────────────────────────────────────────┘  │
│         │                                │           │
│         ▼                                ▼           │
│  ┌──────────────┐              ┌──────────────┐     │
│  │ Sinyal İşleme│              │   REST API   │     │
│  │ (analysis.py)│              │  Endpoints   │     │
│  └──────┬───────┘              └──────────────┘     │
│         │                                            │
│         ├─► Basit Eşik Kontrolü                     │
│         ├─► STA/LTA Algoritması                     │
│         └─► Geofencing Analizi                      │
│                  │                                   │
│                  ▼                                   │
│         ┌─────────────────┐                         │
│         │ Event Detection │                         │
│         │      Loop       │                         │
│         └────────┬────────┘                         │
│                  │                                   │
│                  ▼                                   │
│         ┌─────────────────┐                         │
│         │  Event Matcher  │◄────────┐               │
│         └────────┬────────┘         │               │
│                  │                   │               │
└──────────────────┼───────────────────┼───────────────┘
                   │                   │
                   ▼                   │
          ┌────────────────┐           │
          │ SQLite Database│           │
          │   (models.py)  │           │
          └────────────────┘           │
                                       │
          ┌────────────────────────────┘
          │
          │ GlobalQuake Sync (global_sync.py)
          │
          ├─► USGS API (30s interval)
          └─► EMSC API (30s interval)
```

## Veri Akışı

### 1. Veri Girişi (Data Ingestion)

```python
# Mobil cihaz → WebSocket
{
    "timestamp": "2024-03-19T20:00:00Z",
    "x": 0.05,      # m/s²
    "y": 0.03,      # m/s²
    "z": 9.81,      # m/s²
    "latitude": 41.0082,
    "longitude": 28.9784,
    "region_id": "istanbul-fatih"
}
```

**İşlem Adımları:**
1. WebSocket bağlantısı kabul edilir
2. Cihaz veritabanına kaydedilir/güncellenir
3. Ham veri `sensor_data` tablosuna yazılır
4. Sinyal işleme modülüne gönderilir

### 2. Sinyal İşleme (Signal Processing)

**A. Magnitude Hesaplama:**
```python
magnitude = √(x² + y² + z²)
```

**B. Basit Eşik Kontrolü:**
```python
if magnitude > 0.98 m/s²:  # 0.1g
    trigger = True
```

**C. STA/LTA Algoritması:**
```python
STA = mean(last_1_second_data)
LTA = mean(last_30_second_data)
ratio = STA / LTA

if ratio > 3.0:
    trigger = True
```

### 3. Geofencing ve Kümeleme

**Zaman Penceresi:** 5 saniye

**Yakınlık Kontrolü:**
```python
# Koordinat bazlı
distance = haversine(lat1, lon1, lat2, lon2)
if distance <= 50 km:
    nearby = True

# Bölge ID bazlı
if region_id1 == region_id2:
    nearby = True
```

**Küme Oluşturma:**
- Son 5 saniyedeki tüm tetiklemeler
- Birbirine yakın cihazları grupla
- 3+ cihaz varsa → `POTENTIAL_QUAKE` oluştur

### 4. GlobalQuake Entegrasyonu

**Veri Kaynakları:**

**USGS:**
```http
GET https://earthquake.usgs.gov/fdsnws/event/1/query
?format=geojson
&minmagnitude=2.5
&orderby=time
&starttime=2024-03-19T19:50:00
```

**EMSC:**
```http
GET https://www.seismicportal.eu/fdsnws/event/1/query
?format=json
&minmag=2.5
&orderby=time
&start=2024-03-19T19:50:00
```

**Senkronizasyon:**
- Her 30 saniyede bir çalışır
- Son 10 dakikalık depremleri çeker
- Duplikasyonları filtreler
- `global_events` tablosuna kaydeder

### 5. Olay Eşleştirme (Event Matching)

**Eşleştirme Kriterleri:**

```python
time_match = |local_time - global_time| <= 2 minutes
distance_match = haversine(local_coords, global_coords) <= 100 km
magnitude_match = global_magnitude >= 2.5

if time_match AND distance_match AND magnitude_match:
    matched = True
```

**Karar Ağacı:**

```
Yerel Olay Tespit Edildi
    │
    ├─► GlobalQuake'de eşleşme var mı?
    │   │
    │   ├─► EVET → CONFIRMED_QUAKE (Kırmızı)
    │   │          - Hem yerel hem global doğrulama
    │   │          - En yüksek öncelik
    │   │
    │   └─► HAYIR → EARLY_WARNING (Turuncu)
    │              - Sadece yerel tespit
    │              - Resmi doğrulama bekleniyor
    │
    └─► GlobalQuake'de veri var ama yerel yok
        └─► DISTANT_QUAKE (Mavi)
            - Uzak bölgede deprem
            - Bilgi amaçlı
```

## Veritabanı Şeması

### devices
```sql
id (PK)              VARCHAR
first_seen           DATETIME
last_seen            DATETIME
region_id            VARCHAR
last_latitude        FLOAT
last_longitude       FLOAT
is_active            BOOLEAN
```

### sensor_data
```sql
id (PK)              INTEGER AUTO
device_id (FK)       VARCHAR
timestamp            DATETIME
x, y, z              FLOAT
latitude, longitude  FLOAT
region_id            VARCHAR
magnitude            FLOAT
sta_lta_ratio        FLOAT
```

### local_events
```sql
id (PK)              VARCHAR (UUID)
timestamp            DATETIME
region               VARCHAR
center_lat, center_lon  FLOAT
triggered_devices    TEXT (JSON array)
device_count         INTEGER
avg_magnitude        FLOAT
max_magnitude        FLOAT
status               VARCHAR
detection_method     VARCHAR
```

### global_events
```sql
id (PK)              VARCHAR
source               VARCHAR (USGS/EMSC)
timestamp            DATETIME
latitude, longitude  FLOAT
depth_km             FLOAT
magnitude            FLOAT
magnitude_type       VARCHAR
place                VARCHAR
url                  VARCHAR
fetched_at           DATETIME
```

### alerts
```sql
id (PK)              INTEGER AUTO
timestamp            DATETIME
alert_type           VARCHAR
local_event_id (FK)  VARCHAR
global_event_id (FK) VARCHAR
message              TEXT
priority             VARCHAR
color                VARCHAR
is_active            BOOLEAN
resolved_at          DATETIME
```

## Performans Özellikleri

### Ölçeklenebilirlik
- **WebSocket bağlantıları:** 1000+ eşzamanlı
- **Veri işleme hızı:** ~100 veri/saniye/cihaz
- **Tespit gecikmesi:** < 1 saniye
- **Veritabanı:** SQLite (küçük-orta ölçek), PostgreSQL önerilir (büyük ölçek)

### Bellek Kullanımı
- **STA buffer:** ~100 değer/cihaz
- **LTA buffer:** ~3000 değer/cihaz
- **Recent triggers:** Son 10000 tetikleme
- **Toplam:** ~50 MB (1000 cihaz için)

### Ağ Trafiği
- **Gelen:** ~100 bytes/saniye/cihaz
- **Giden (broadcast):** Sadece uyarı anında
- **GlobalQuake:** ~10 KB/30 saniye

## Güvenlik Konuları

### Mevcut Durum
- ✅ CORS etkin (tüm originler)
- ✅ WebSocket bağlantı yönetimi
- ⚠️ Kimlik doğrulama YOK
- ⚠️ Rate limiting YOK
- ⚠️ HTTPS/WSS YOK

### Üretim İçin Öneriler
1. **Kimlik Doğrulama:** JWT token sistemi
2. **Rate Limiting:** FastAPI-Limiter kullanımı
3. **HTTPS/WSS:** SSL sertifikası (Let's Encrypt)
4. **CORS:** Sadece güvenilir originlere izin
5. **Input Validation:** Pydantic modelleri ile
6. **SQL Injection:** SQLAlchemy ORM kullanımı (mevcut)

## Hata Yönetimi

### WebSocket Bağlantı Hataları
```python
try:
    await websocket.receive_json()
except WebSocketDisconnect:
    # Cihazı pasif yap
    device.is_active = False
```

### GlobalQuake API Hataları
```python
try:
    response = await client.get(url)
    response.raise_for_status()
except Exception as e:
    logger.error(f"API error: {e}")
    # Boş liste döndür, devam et
    return []
```

### Veritabanı Hataları
```python
try:
    db.commit()
except Exception as e:
    logger.error(f"DB error: {e}")
    db.rollback()
```

## Genişletme Noktaları

### 1. Makine Öğrenimi
- P-dalgası/S-dalgası ayrımı
- Magnitude tahmini
- Yanlış alarm azaltma

### 2. Görselleştirme
- Gerçek zamanlı harita (Leaflet.js)
- Cihaz durumu dashboard
- Deprem geçmişi grafikleri

### 3. Bildirim Sistemi
- Push notifications (FCM, APNS)
- SMS uyarıları (Twilio)
- Email bildirimleri

### 4. Veri Analizi
- Deprem istatistikleri
- Bölgesel risk analizi
- Cihaz güvenilirlik skoru

### 5. Yüksek Erişilebilirlik
- Multi-region deployment
- Load balancing
- Database replication
- Redis cache

## Konfigürasyon Parametreleri

### Tespit Hassasiyeti
```python
THRESHOLD_SIMPLE_G = 0.1          # ↓ Daha hassas
STA_LTA_TRIGGER_RATIO = 3.0       # ↓ Daha hassas
```

### Geofencing
```python
GEOFENCING_RADIUS_KM = 50.0       # ↑ Daha geniş alan
TIME_WINDOW_SECONDS = 5           # ↑ Daha uzun pencere
MIN_DEVICES_FOR_TRIGGER = 3       # ↓ Daha az cihaz
```

### GlobalQuake
```python
GLOBAL_SYNC_INTERVAL_SECONDS = 30  # ↓ Daha sık güncelleme
GLOBAL_SYNC_LOOKBACK_MINUTES = 10  # ↑ Daha uzun geçmiş
MIN_GLOBAL_MAGNITUDE = 2.5         # ↓ Daha küçük depremler
```

### Eşleştirme
```python
TIME_TOLERANCE_MINUTES = 2         # ↑ Daha esnek zaman
DISTANCE_TOLERANCE_KM = 100.0      # ↑ Daha geniş alan
```

## Test Senaryoları

### 1. Normal Operasyon
- 10 cihaz bağlı
- Normal ivme değerleri
- Hiç tetikleme yok

### 2. Tek Cihaz Tetikleme
- 1 cihaz eşik aşıyor
- Diğerleri normal
- Olay oluşturulmamalı (< 3 cihaz)

### 3. Yerel Deprem (Erken Uyarı)
- 5 cihaz aynı bölgede tetikleniyor
- GlobalQuake'de henüz veri yok
- EARLY_WARNING oluşturulmalı

### 4. Doğrulanmış Deprem
- 5 cihaz tetikleniyor
- 1 dakika sonra USGS M4.2 kaydediyor
- CONFIRMED_QUAKE'e güncellenmeli

### 5. Uzak Deprem
- Hiç cihaz tetiklenmiyor
- USGS M5.0 kaydediyor (500 km uzakta)
- DISTANT_QUAKE oluşturulmalı

## Monitoring ve Logging

### Önemli Metrikler
- Aktif cihaz sayısı
- Saniyedeki veri paketi sayısı
- Tespit edilen olay sayısı
- GlobalQuake sync başarı oranı
- Ortalama yanıt süresi

### Log Seviyeleri
- **DEBUG:** Detaylı veri işleme
- **INFO:** Bağlantılar, olaylar, uyarılar
- **WARNING:** API hataları, timeout'lar
- **ERROR:** Kritik hatalar, veritabanı sorunları

---

**Son Güncelleme:** 2024-03-19
