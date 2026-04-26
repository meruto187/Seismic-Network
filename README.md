# SismoNetwork — Telefon Tabanlı Deprem Erken Uyarı Sistemi

Android telefonların ivmeölçerlerinden gelen gerçek zamanlı verileri analiz eden, küresel deprem verileriyle (USGS, EMSC, KOERI, AFAD) eşleştiren ve erken uyarı sağlayan açık kaynaklı bir deprem ağı.

> 🌐 **Canlı backend:** `https://seismic.meruto.com.tr`  
> 📱 **Android app:** Expo Go ile test edilebilir, APK build yakında  
> 🖥️ **Windows app:** Planlanıyor (Electron + Fluent UI)

---

## 🎯 Özellikler

### Backend
- ✅ **Gerçek Zamanlı Sensör Alımı** — WebSocket üzerinden çoklu cihaz desteği
- ✅ **Çift Katmanlı Deprem Tespiti** — Basit eşik + STA/LTA algoritması
- ✅ **Geofencing** — 50 km yarıçap + bölge ID bazlı gruplama
- ✅ **Küresel Veri Kaynakları** — USGS, EMSC, KOERI, AFAD entegrasyonu
- ✅ **Akıllı Eşleştirme** — Sensör verileri ile resmi deprem verilerini karşılaştırır
- ✅ **Erken Uyarı** — Resmi doğrulama öncesi uyarı üretir
- ✅ **REST API + WebSocket** — Cihazlar, olaylar, uyarılar, canlı sensör özeti
- ✅ **Web Dashboard** — Leaflet harita, canlı cihaz ve deprem listesi
- ✅ **Chat** — WebSocket üzerinden anlık mesajlaşma (flood koruması dahil)
- ✅ **Manuel Rapor** — `/report` endpoint'i ile sarsıntı raporu alma

### Android Uygulaması
- ✅ **Material You Tema** — Sistem renk paletine uyum (Android 12+)
- ✅ **4 Sekme:** Uyarılar / Deprem Listesi / Rapor / Ayarlar+Chat
- ✅ **Canlı Sensör İzleme** — İvmeölçer verisi WebSocket ile sunucuya aktarılır
- ✅ **GPS Bölge Tespiti** — Konum bazlı otomatik `region_id`
- ✅ **Deprem Listesi** — Kaynak filtresi, büyüklük renk skalası, konuma mesafe
- ✅ **MMI Sarsıntı Raporu** — II–VII Mercalli skalası ile manuel rapor
- ✅ **Alarm Özelleştirme** — Minimum büyüklük eşiği, mesafe filtresi, bildirim tipi
- ✅ **Sohbet** — Gerçek zamanlı mesajlaşma, küfür filtresi, flood koruması

---

## 🏗️ Mimari

```
seismic-network/
├── main.py              # FastAPI backend, WebSocket, REST API
├── analysis.py          # STA/LTA sinyal işleme, geofencing
├── models.py            # SQLAlchemy veritabanı modelleri
├── global_sync.py       # USGS + EMSC senkronizasyonu
├── koeri_sync.py        # KOERI (Kandilli) senkronizasyonu
├── afad_sync.py         # AFAD senkronizasyonu
├── config.py            # Yapılandırma
└── android-app/
    ├── App.tsx           # Tab navigation + Material You tema
    ├── context/
    │   └── SeismicContext.tsx  # WebSocket, sensör, chat, ayarlar
    └── screens/
        ├── AlertsScreen.tsx    # Uyarılar + ağ durumu
        ├── QuakeListScreen.tsx # Küresel deprem listesi
        ├── ReportScreen.tsx    # MMI sarsıntı raporu
        └── SettingsScreen.tsx  # Ayarlar + sohbet
```

---

## 📋 Gereksinimler

### Backend
- Python 3.9+
- Ubuntu 22.04+ (VDS/VPS önerilir)

### Android Uygulaması
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go uygulaması (test için)

---

## 🚀 Kurulum

### Backend

```bash
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

### Android Uygulaması

```bash
cd android-app
npm install
npx expo start --lan
```

Expo Go ile QR kodu tara.

---

## 🔮 Yol Haritası

- [ ] APK / standalone build (EAS Build)
- [ ] Windows masaüstü uygulaması (Electron + Fluent UI)
- [ ] Çoklu cihaz yönetim paneli
- [ ] Ülke bazlı chat odaları
- [ ] INGV, GFZ ek veri kaynakları
- [ ] iOS desteği

## 📡 API Kullanımı

### WebSocket Bağlantısı (Android Uygulaması İçin)

React Native Android uygulamasından WebSocket bağlantısı kurun:

```javascript
// Sunucu IP adresinizi kullanın (localhost değil!)
const ws = new WebSocket('ws://YOUR_SERVER_IP:8000/ws/sensor/DEVICE_ID');

// Veri gönderme
ws.send(JSON.stringify({
    timestamp: new Date().toISOString(),
    x: 0.05,  // m/s²
    y: 0.03,  // m/s²
    z: 9.81,  // m/s²
    latitude: 41.0082,
    longitude: 28.9784,
    region_id: "istanbul-fatih"
}));

// Yanıt alma
ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    console.log('Magnitude:', data.magnitude);
    console.log('Triggered:', data.triggered);
};
```

### REST API Endpoints

#### Sistem Durumu
```bash
GET /status
```

Yanıt:
```json
{
    "active_devices": 15,
    "total_devices": 42,
    "total_sensor_data": 125847,
    "active_alerts": 2,
    "local_events": 8,
    "global_events": 156,
    "websocket_connections": 15
}
```

#### Uyarıları Görüntüleme
```bash
GET /alerts?active_only=true&limit=50
```

#### Cihazları Listeleme
```bash
GET /devices?active_only=true
```

#### Olayları Görüntüleme
```bash
GET /events?event_type=all&limit=50
```

Event types: `all`, `local`, `global`

#### Uyarıyı Çözümleme
```bash
POST /alerts/{alert_id}/resolve
```

## 🔍 Tespit Mantığı

### P-Dalgası Analizi

**1. Basit Eşik Kontrolü:**
- Vektör büyüklüğü: `magnitude = √(x² + y² + z²)`
- Eşik: `> 0.1g (0.98 m/s²)`

**2. STA/LTA Algoritması:**
- STA penceresi: 1 saniye
- LTA penceresi: 30 saniye
- Tetikleme oranı: `STA/LTA > 3.0`

### Geofencing Kuralları

- **Zaman penceresi**: 5 saniye içinde
- **Minimum cihaz**: 3+ cihaz
- **Koordinat bazlı**: Haversine formülü ile 50 km yarıçap
- **Bölge ID bazlı**: Aynı `region_id` değeri

### Karar Matrisi

| Durum | Yerel Sensörler | Resmi Veri (USGS/EMSC) | Sonuç |
|-------|----------------|------------------------|-------|
| 1 | ✅ Tetiklendi | ❌ Veri yok | **ERKEN UYARI** (Turuncu) |
| 2 | ✅ Tetiklendi | ✅ Eşleşti | **DOĞRULANMIŞ DEPREM** (Kırmızı) |
| 3 | ❌ Sessiz | ✅ Vari var | **UZAK DEPREM** (Mavi) |
| 4 | ❌ Sessiz | ❌ Veri yok | Normal durum |

### Eşleştirme Kriterleri

- **Zaman toleransı**: ±2 dakika
- **Mesafe toleransı**: 100 km yarıçap
- **Minimum resmi veri magnitude**: M ≥ 2.5

## 🗄️ Veritabanı Şeması

Sistem SQLite kullanır ve aşağıdaki tabloları içerir:

- `devices` - Kayıtlı cihazlar
- `sensor_data` - Ham ivme verileri
- `local_events` - Yerel tespit edilen olaylar
- `global_events` - USGS ve EMSC'den çekilen depremler
- `alerts` - Üretilen uyarılar

## ⚙️ Konfigürasyon

`config.py` dosyasında ayarları değiştirebilirsiniz:

```python
THRESHOLD_SIMPLE_G = 0.1              # Basit eşik (g cinsinden)
STA_LTA_TRIGGER_RATIO = 3.0           # STA/LTA tetikleme oranı
GEOFENCING_RADIUS_KM = 50.0           # Geofencing yarıçapı
TIME_WINDOW_SECONDS = 5               # Zaman penceresi
MIN_DEVICES_FOR_TRIGGER = 3           # Minimum cihaz sayısı
GLOBAL_SYNC_INTERVAL_SECONDS = 30     # Resmi veri senkronizasyon aralığı
```

## 📊 Örnek Kullanım Senaryosu

1. **Başlangıç**: 15 Android telefon uygulaması WebSocket ile bağlanır
2. **Normal Durum**: Telefonlar sürekli x, y, z ivme verisi gönderir
3. **Sarsıntı**: İstanbul'da 5 telefon eşik üstü ivme tespit eder
4. **Tetikleme**: 5 saniye içinde 5 cihaz > 3 cihaz kuralını karşılar
5. **Yerel Olay**: Sistem "POTANSİYEL DEPREM" oluşturur
6. **Resmi Veri Kontrolü**: USGS/EMSC'de henüz veri yok
7. **ERKEN UYARI**: Tüm bağlı cihazlara turuncu uyarı gönderilir
8. **Doğrulama**: 45 saniye sonra USGS M4.2 deprem kaydeder
9. **Eşleştirme**: Sistem yerel olay ile USGS verisini eşleştirir
10. **DOĞRULANMIŞ DEPREM**: Kırmızı uyarı güncellenir

## 🔧 Geliştirme

### Proje Yapısı

```
seismic-network/
├── main.py              # FastAPI sunucusu ve WebSocket yönetimi
├── analysis.py          # Sinyal işleme ve P-dalgası tespiti
├── global_sync.py       # USGS ve EMSC entegrasyonu
├── models.py            # SQLAlchemy veritabanı modelleri
├── config.py            # Sistem konfigürasyonu
├── requirements.txt     # Python bağımlılıkları
└── README.md           # Bu dosya
```

### Loglama

Sistem `INFO` seviyesinde log üretir. Log seviyesini değiştirmek için:

```bash
export LOG_LEVEL=DEBUG
python main.py
```

## 🌐 Resmi Deprem Veri Kaynakları

**Şu Anda Kullanılan:**
- **USGS**: https://earthquake.usgs.gov/fdsnws/event/1/
- **EMSC**: https://www.seismicportal.eu/fdsnws/event/1/

Sistem her 30 saniyede bir her iki kaynaktan da son 10 dakikalık depremleri çeker.

**Gelecekte Eklenebilir:**
- **GlobalQuake.net**: https://globalquake.net/ - Açık kaynak sismik ağ projesi
  - Topluluk tabanlı deprem tespiti
  - API dokümantasyonu mevcut olduğunda entegre edilebilir

## 📱 Android Uygulama (React Native)

### Kurulum

```bash
cd android-app
npm install
```

### Android Studio'da Çalıştırma

1. Android Studio'yu açın
2. `android-app/android` klasörünü açın
3. Emulator veya fiziksel cihaz bağlayın
4. Run tuşuna basın

### APK Oluşturma

```bash
cd android-app/android
./gradlew assembleRelease
# APK: android/app/build/outputs/apk/release/app-release.apk
```

### Veri Formatı

Android uygulaması şu verileri gönderir:

```json
{
    "timestamp": "2024-03-19T20:00:00Z",
    "x": 0.05,
    "y": 0.03,
    "z": 9.81,
    "latitude": 41.0082,
    "longitude": 28.9784,
    "region_id": "istanbul-fatih"
}
```

- `x, y, z`: İvme değerleri (m/s²)
- `latitude, longitude`: GPS koordinatları (opsiyonel)
- `region_id`: Bölge tanımlayıcısı (opsiyonel)

## 🛡️ Güvenlik Notları

- Üretim ortamında CORS ayarlarını sınırlandırın
- HTTPS kullanın (WebSocket için WSS)
- API rate limiting ekleyin
- Cihaz kimlik doğrulaması uygulayın

## 📄 Lisans

Bu proje eğitim ve araştırma amaçlıdır.

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit yapın (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request açın

## 📞 İletişim

Sorularınız için issue açabilirsiniz.

---

**Not**: Bu sistem gerçek zamanlı deprem tespiti için tasarlanmıştır ancak resmi deprem uyarı sistemlerinin yerini almaz. Sadece erken uyarı ve bilgilendirme amaçlıdır.
