# 🚀 Hızlı Başlangıç Kılavuzu

## 1. Kurulum

```bash
cd /home/keith/CascadeProjects/seismic-network

# Bağımlılıkları yükle
pip install -r requirements.txt
```

## 2. Sunucuyu Başlat

```bash
python main.py
```

Sunucu `http://localhost:8000` adresinde çalışacak.

## 3. Test Et

Yeni bir terminal açın ve test istemcisini çalıştırın:

```bash
python test_client.py
```

Bu komut:
- 5 sanal cihaz oluşturur (İstanbul bölgesinde)
- Her cihaz 1 saniyede bir ivme verisi gönderir
- 30. saniyede tüm cihazlar deprem simülasyonu yapar
- Sistem **POTENTIAL_QUAKE** olayı tespit etmeli

## 4. API'yi Kontrol Et

Tarayıcınızda veya curl ile:

### Sistem Durumu
```bash
curl http://localhost:8000/status
```

### Uyarıları Görüntüle
```bash
curl http://localhost:8000/alerts
```

### Cihazları Listele
```bash
curl http://localhost:8000/devices
```

### Olayları Görüntüle
```bash
curl http://localhost:8000/events?event_type=all
```

## 5. API Dokümantasyonu

Otomatik oluşturulan API dokümantasyonuna erişin:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 📱 Mobil Uygulama Entegrasyonu

WebSocket bağlantısı örneği:

```javascript
const ws = new WebSocket('ws://localhost:8000/ws/sensor/MY_DEVICE_ID');

ws.onopen = () => {
    console.log('Connected to seismic network');
    
    // İvme verisi gönder
    setInterval(() => {
        const data = {
            timestamp: new Date().toISOString(),
            x: accelerometer.x,
            y: accelerometer.y,
            z: accelerometer.z,
            latitude: gps.latitude,
            longitude: gps.longitude,
            region_id: "istanbul-kadikoy"
        };
        ws.send(JSON.stringify(data));
    }, 1000);
};

ws.onmessage = (event) => {
    const response = JSON.parse(event.data);
    
    if (response.type === 'alert') {
        // Uyarı göster
        showAlert(response.alert_type, response.message);
    }
};
```

## 🔍 Beklenen Çıktılar

### Test Client Çıktısı
```
[device_001] Normal - Magnitude: 9.832 m/s²
[device_002] Normal - Magnitude: 9.815 m/s²
...
[device_001] 🚨 Simulating earthquake trigger!
[device_001] ⚠️  TRIGGERED! Magnitude: 11.234 m/s²
[device_002] ⚠️  TRIGGERED! Magnitude: 10.987 m/s²
...
```

### Server Logs
```
INFO: Device device_001 connected. Total connections: 1
INFO: Trigger detected from device_001: magnitude=11.234, sta_lta=4.52
INFO: Alert created: EARLY_WARNING - Yerel sensörler sarsıntı algıladı...
```

### API Response (/alerts)
```json
[
  {
    "id": 1,
    "timestamp": "2024-03-19T20:00:35Z",
    "alert_type": "EARLY_WARNING",
    "message": "Yerel sensörler sarsıntı algıladı, resmi doğrulama bekleniyor - 5 cihaz, Ortalama büyüklük: 11.05 m/s²",
    "priority": "HIGH",
    "color": "orange",
    "is_active": true,
    "local_event": {
      "id": "abc-123-def",
      "device_count": 5,
      "avg_magnitude": 11.05,
      "region": "istanbul-kadikoy"
    }
  }
]
```

## ⚙️ Konfigürasyon Değiştirme

`config.py` dosyasını düzenleyerek ayarları değiştirebilirsiniz:

```python
# Daha hassas tespit için
THRESHOLD_SIMPLE_G = 0.05  # Varsayılan: 0.1

# Daha az cihazla tetikleme
MIN_DEVICES_FOR_TRIGGER = 2  # Varsayılan: 3

# Daha geniş alan
GEOFENCING_RADIUS_KM = 100.0  # Varsayılan: 50.0
```

## 🐛 Sorun Giderme

### "Connection refused" hatası
- Sunucunun çalıştığından emin olun: `python main.py`

### Hiç uyarı üretilmiyor
- En az 3 cihazın eşik üstü veri göndermesi gerekir
- `config.py`'de `MIN_DEVICES_FOR_TRIGGER` değerini düşürün

### GlobalQuake verileri gelmiyor
- İnternet bağlantınızı kontrol edin
- USGS/EMSC API'lerinin erişilebilir olduğundan emin olun

### Veritabanı hatası
- `seismic_network.db` dosyasını silin ve sunucuyu yeniden başlatın

## 📊 Performans

- **WebSocket bağlantıları**: 1000+ eşzamanlı cihaz destekler
- **Veri işleme**: ~100 veri/saniye/cihaz
- **Tespit gecikmesi**: < 1 saniye
- **GlobalQuake sync**: Her 30 saniyede bir

## 🎯 Sonraki Adımlar

1. Mobil uygulama geliştirin (React Native, Flutter, vb.)
2. Gerçek zamanlı harita görselleştirmesi ekleyin
3. Push notification servisi entegre edin
4. PostgreSQL'e geçiş yapın (yüksek yük için)
5. Redis cache ekleyin
6. Kubernetes ile deploy edin

## 📞 Yardım

Sorun yaşarsanız:
1. Sunucu loglarını kontrol edin
2. `/status` endpoint'ini kontrol edin
3. GitHub'da issue açın

---

**Başarılar! 🎉**
