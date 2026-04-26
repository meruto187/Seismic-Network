# Kurulum ve Çalıştırma Kılavuzu

Bu kılavuz, sismik ağ sisteminin backend sunucusunu ve Android uygulamasını kurup çalıştırmanız için adım adım talimatlar içerir.

## 📋 Sistem Gereksinimleri

### Backend Sunucu
- **İşletim Sistemi**: Linux, macOS veya Windows
- **Python**: 3.9 veya üzeri
- **RAM**: Minimum 512 MB
- **Disk**: 100 MB boş alan

### Android Uygulama Geliştirme
- **Node.js**: 18 veya üzeri
- **Android Studio**: Arctic Fox veya üzeri
- **JDK**: 11 veya üzeri
- **Android SDK**: API 34 veya üzeri
- **RAM**: Minimum 8 GB (Android Studio için)

## 🚀 Backend Sunucu Kurulumu

### 1. Proje Dizinine Gidin
```bash
cd /home/keith/CascadeProjects/seismic-network
```

### 2. Python Sanal Ortamı Oluşturun (Opsiyonel ama Önerilen)
```bash
python3 -m venv venv
source venv/bin/activate  # Linux/Mac
# veya
venv\Scripts\activate  # Windows
```

### 3. Bağımlılıkları Yükleyin
```bash
pip install -r requirements.txt
```

### 4. Sunucuyu Başlatın
```bash
python main.py
```

Sunucu `http://0.0.0.0:8000` adresinde çalışmaya başlayacak.

### 5. Sunucuyu Test Edin
Yeni bir terminal açın:
```bash
curl http://localhost:8000/status
```

Başarılı yanıt:
```json
{
  "active_devices": 0,
  "total_devices": 0,
  "total_sensor_data": 0,
  "active_alerts": 0,
  "local_events": 0,
  "global_events": 0,
  "websocket_connections": 0
}
```

## 📱 Android Uygulama Kurulumu

### 1. Node.js ve npm Kurulumu
```bash
# Node.js versiyonunu kontrol edin
node --version  # v18+ olmalı
npm --version
```

Node.js yoksa: https://nodejs.org/

### 2. React Native CLI Kurulumu
```bash
npm install -g react-native-cli
```

### 3. Android Studio Kurulumu

1. https://developer.android.com/studio adresinden indirin
2. Kurulum sırasında "Android SDK", "Android SDK Platform" ve "Android Virtual Device" seçeneklerini işaretleyin
3. SDK Manager'dan Android 13.0 (API 33) yükleyin
4. SDK Manager'dan Android 14 (API 34) ve Build-Tools 34.0.0 yüklü olduğundan emin olun

### 4. Android SDK Yolunu Ayarlayın

**Linux/Mac:**
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

Bu satırları `~/.bashrc` veya `~/.zshrc` dosyanıza ekleyin.

**Windows:**
- Sistem Özellikleri > Gelişmiş > Ortam Değişkenleri
- Yeni sistem değişkeni: `ANDROID_HOME = C:\Users\KULLANICI_ADI\AppData\Local\Android\Sdk`
- Path'e ekleyin: `%ANDROID_HOME%\platform-tools`

### 5. Uygulama Bağımlılıklarını Yükleyin
```bash
cd android-app
npm install
```

### 6. Sunucu IP Adresini Ayarlayın

`android-app/App.tsx` dosyasını açın ve sunucu IP'nizi girin:

```typescript
// Satır 18
const SERVER_URL = 'ws://192.168.1.100:8000'; // Kendi IP'nizi yazın
```

**Sunucu IP'nizi bulmak için:**

Linux/Mac:
```bash
ifconfig | grep "inet "
# veya
ip addr show
```

Windows:
```bash
ipconfig
```

**Önemli**: `localhost` veya `127.0.0.1` kullanmayın! Gerçek IP adresinizi kullanın.

## 🔧 Android Uygulamasını Çalıştırma

### Seçenek 1: Android Emulator (Önerilen Test İçin)

1. **Android Studio'yu açın**
2. **Tools > Device Manager** menüsüne gidin
3. **Create Device** butonuna tıklayın
4. Bir cihaz seçin (örn: Pixel 5)
5. Sistem imajı seçin (API 33, Android 13.0)
6. **Finish** butonuna tıklayın
7. Emulator'ı başlatın (▶️ butonu)

8. **Uygulamayı çalıştırın:**
```bash
cd android-app
npm run android
```

### Seçenek 2: Fiziksel Android Cihaz (Gerçek Test İçin)

1. **Geliştirici Seçeneklerini Etkinleştirin:**
   - Ayarlar > Telefon Hakkında
   - "Yapı Numarası"na 7 kez dokunun
   - "Geliştirici oldunuz!" mesajını görün

2. **USB Debugging'i Açın:**
   - Ayarlar > Geliştirici Seçenekleri
   - "USB Debugging" seçeneğini açın

3. **Cihazı Bilgisayara Bağlayın:**
   - USB kablosu ile bağlayın
   - Telefonda "USB Debugging'e izin ver" onayını verin

4. **Cihazın Tanındığını Kontrol Edin:**
```bash
adb devices
```

Çıktı:
```
List of devices attached
ABC123XYZ    device
```

5. **Uygulamayı Çalıştırın:**
```bash
cd android-app
npm run android
```

## 📦 APK Oluşturma ve Yükleme

### Debug APK (Test İçin)

```bash
cd android-app/android
./gradlew clean && ./gradlew assembleDebug --stacktrace
```

APK konumu: `android/app/build/outputs/apk/debug/app-debug.apk`

### Telefona Yükleme

**USB ile:**
```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

**Manuel:**
1. APK dosyasını telefona kopyalayın
2. Dosya yöneticisinden APK'yı açın
3. "Bilinmeyen Kaynaklardan Yükleme" iznini verin
4. Yükle butonuna basın

### Release APK (Dağıtım İçin)

```bash
cd android-app/android
./gradlew clean && ./gradlew assembleRelease --stacktrace
```

APK konumu: `android/app/build/outputs/apk/release/app-release.apk`

## 🚀 Temizlik ve İlk Build

AGP `8.2.1` ile temiz bir build almak için aşağıdaki komutu kullanın:

```bash
./gradlew clean && ./gradlew assembleDebug --stacktrace
```

Bu komut zinciri şunları sağlar:

- **`clean`**: Eski veya bozuk build kalıntılarını temizler
- **`assembleDebug`**: Test için debug APK üretir
- **`--stacktrace`**: Hata oluşursa detaylı traceback verir

## 🎯 Kullanım

### Backend Sunucu

1. **Sunucuyu başlatın:**
```bash
python main.py
```

2. **API dokümantasyonuna erişin:**
   - Swagger UI: http://localhost:8000/docs
   - ReDoc: http://localhost:8000/redoc

3. **Durumu kontrol edin:**
```bash
curl http://localhost:8000/status
```

### Android Uygulama

1. **Uygulamayı açın**
2. **İzinleri verin:**
   - Konum izni
   - Bildirim izni (Android 13+)

3. **İzlemeyi başlatın:**
   - "İzleme Aktif" switch'ini açın
   - Bağlantı durumunu kontrol edin (yeşil nokta = bağlı)

4. **Sensör verilerini izleyin:**
   - X, Y, Z ivme değerleri
   - Vektör büyüklüğü
   - GPS koordinatları

5. **Uyarıları bekleyin:**
   - Deprem tespit edildiğinde bildirim gelir
   - Uyarılar listede görünür

## 🧪 Test Senaryosu

### 1. Backend'i Test Edin

Terminal 1 - Sunucu:
```bash
python main.py
```

Terminal 2 - Test İstemcisi:
```bash
python test_client.py
```

Test istemcisi 5 sanal cihaz oluşturur ve 30. saniyede deprem simülasyonu yapar.

### 2. Android Uygulamasını Test Edin

1. Uygulamayı başlatın
2. İzlemeyi açın
3. Telefonu sallamaya başlayın (emulator'da manuel veri girin)
4. Backend loglarında veri geldiğini görün:
```
INFO: Device android_xyz connected. Total connections: 1
INFO: Trigger detected from android_xyz: magnitude=11.234, sta_lta=4.52
```

### 3. Çoklu Cihaz Testi

1. 3+ telefonda uygulamayı çalıştırın
2. Hepsinde izlemeyi açın
3. Aynı anda telefonları sallayın
4. Backend'de "POTENTIAL_QUAKE" oluştuğunu görün
5. Tüm telefonlara uyarı gelmesini bekleyin

## 🐛 Sorun Giderme

### Backend Sorunları

**"Address already in use" hatası:**
```bash
# Port 8000'i kullanan işlemi bulun
lsof -i :8000
# veya
netstat -ano | findstr :8000

# İşlemi sonlandırın
kill -9 PID
```

**"ModuleNotFoundError" hatası:**
```bash
pip install -r requirements.txt
```

**USGS/EMSC API'ye erişilemiyor:**
- İnternet bağlantınızı kontrol edin
- Firewall ayarlarını kontrol edin
- VPN kullanıyorsanız kapatın

### Android Uygulama Sorunları

**"Unable to connect to development server":**
```bash
# Metro bundler'ı manuel başlatın
cd android-app
npm start

# Yeni terminalde
npm run android
```

**"WebSocket connection failed":**
- Backend sunucusunun çalıştığını kontrol edin
- `SERVER_URL` IP adresinin doğru olduğunu kontrol edin
- Telefon ve bilgisayarın aynı WiFi ağında olduğunu kontrol edin
- Firewall'un 8000 portunu engellediğini kontrol edin

**"Location permission denied":**
- Uygulama Ayarları > İzinler > Konum > İzin Ver
- Android 13+: Ayarlar > Uygulamalar > Sismik Ağ > İzinler

**APK yüklenmiyor:**
- Ayarlar > Güvenlik > Bilinmeyen Kaynaklardan Yükleme > İzin Ver
- Eski sürümü kaldırın: `adb uninstall com.seismicnetworkapp`

**Gradle build hatası:**
```bash
cd android-app/android
./gradlew clean
./gradlew assembleDebug
```

## 🔒 Güvenlik Notları

### Geliştirme Ortamı
- ✅ HTTP ve WS kullanılabilir
- ✅ Kimlik doğrulama opsiyonel
- ✅ Cleartext traffic izinli

### Üretim Ortamı
- ⚠️ HTTPS ve WSS kullanın
- ⚠️ SSL sertifikası edinin (Let's Encrypt)
- ⚠️ API key veya JWT token ekleyin
- ⚠️ Rate limiting uygulayın
- ⚠️ CORS ayarlarını sınırlandırın
- ⚠️ Cleartext traffic'i kapatın

## 📊 Performans İpuçları

### Backend
- PostgreSQL kullanın (SQLite yerine, yüksek yük için)
- Redis cache ekleyin
- Nginx reverse proxy kullanın
- Gunicorn ile çoklu worker çalıştırın

### Android
- Sensör frekansını ayarlayın (batarya tasarrufu)
- Arka plan servisi kullanın (sürekli izleme)
- Veri gönderme aralığını optimize edin

### 8 GB RAM İçin Yerel Geliştirme Karar Mekanizması

- **Backend ve Metro'yu birlikte çalıştırın, Android Studio emulator'ünü gerekmedikçe kapalı tutun**
- **Mümkünse fiziksel Android cihaz kullanın**; emulator ciddi RAM tüketir
- **İvme verisini ham halde 50-100 Hz göndermek yerine örnekleme düşürün**; başlangıçta `10-20 Hz` yeterlidir
- **Sunucuya her örneği göndermek yerine kısa pencereleme kullanın**; örneğin her `100-200 ms` bir paket gönderin
- **Python backend için debug log seviyesini sadece gerektiğinde açın**; normalde `INFO` kullanın
- **Metro dışında gereksiz tarayıcı/IDE sekmelerini kapatın**
- **İlk aşamada tek cihaz + tek backend ile test edin**, sonra çoklu cihaza geçin

Önerilen ilk çalışma düzeni:

- **1. Aşama**: `python main.py`
- **2. Aşama**: `npm start`
- **3. Aşama**: fiziksel cihazda `npm run android`
- **4. Aşama**: veri gönderim oranını kademeli artırın

## 🎓 Sonraki Adımlar

1. ✅ Backend sunucusunu başlatın
2. ✅ Android uygulamasını derleyin
3. ✅ Sunucu IP'sini ayarlayın
4. ✅ Uygulamayı test edin
5. ✅ Çoklu cihazla test edin
6. 🔜 Üretim için güvenlik ekleyin
7. 🔜 GlobalQuake.net API'sini entegre edin
8. 🔜 Makine öğrenimi ile P/S dalgası ayrımı

## 📞 Destek

Sorun yaşarsanız:
1. Logları kontrol edin (`python main.py` çıktısı)
2. Android logcat'i kontrol edin (`adb logcat`)
3. README.md dosyalarını okuyun
4. GitHub'da issue açın

---

**Başarılar! 🎉**

Sisteminiz artık çalışmaya hazır. Backend sunucusu deprem verilerini topluyor ve Android uygulaması ivmeölçer verilerini gönderiyor.
