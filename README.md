# Merkezi Sismik Ağ - Telefon İvmeölçer Tabanlı Deprem Tespit Sistemi

Android telefonların ivmeölçerlerinden gelen gerçek zamanlı verileri analiz eden, resmi deprem verileriyle (USGS ve EMSC) eşleştiren ve erken deprem uyarısı sağlayan bir sistem.

## 🎯 Özellikler

- ✅ **Gerçek Zamanlı Veri Alımı**: WebSocket üzerinden Android telefon ivmeölçer verilerini kabul eder
- ✅ **Çift Katmanlı P-Dalgası Tespiti**: 
  - Basit eşik kontrolü (> 0.1g)
  - STA/LTA (Short-Term Average / Long-Term Average) algoritması
- ✅ **Esnek Geofencing**: Hem koordinat bazlı (50 km yarıçap) hem de bölge ID bazlı gruplandırma
- ✅ **Resmi Deprem Verisi Entegrasyonu**: USGS ve EMSC API'lerinden veri toplama
- ✅ **Akıllı Eşleştirme**: Yerel sensör verileriyle resmi deprem verilerini karşılaştırma
- ✅ **Erken Uyarı Sistemi**: Resmi doğrulama öncesi uyarı üretme
- ✅ **REST API**: Durum sorgulama ve veri erişimi için HTTP endpoints
- 🔮 **Gelecek**: [GlobalQuake.net](https://globalquake.net/) API entegrasyonu planlanıyor

## 📋 Gereksinimler

### Backend Sunucu (Bu Proje)
- Python 3.9+
- pip

### Android Uygulama (android-app/ klasörü)
- Node.js 18+
- React Native CLI
- Android Studio
- Android SDK (API 24+)

## 🚀 Kurulum

1. **Bağımlılıkları yükleyin:**
```bash
pip install -r requirements.txt
```

2. **Sunucuyu başlatın:**
```bash
python main.py
```

Sunucu varsayılan olarak `http://0.0.0.0:8000` adresinde çalışacaktır.

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
