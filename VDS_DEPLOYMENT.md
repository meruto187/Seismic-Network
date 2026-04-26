# VDS Deployment Guide - Seismic Network Backend

Bu rehber, Ubuntu VDS üzerinde Seismic Network backend'ini kurulum ve çalıştırma adımlarını içerir.

## Sistem Gereksinimleri

- **İşletim Sistemi:** Ubuntu 20.04 LTS veya üzeri
- **RAM:** Minimum 2GB (4GB önerilir)
- **Disk:** Minimum 10GB boş alan
- **Python:** 3.9 veya üzeri
- **Port:** 8000 (veya özel port)

## 1. Sunucu Hazırlığı

### Sistem Güncellemesi

```bash
sudo apt update
sudo apt upgrade -y
```

### Gerekli Paketlerin Kurulumu

```bash
sudo apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx ufw git openjdk-17-jre
```

**Not:** `openjdk-17-jre` GlobalQuake 0.11.1 için gereklidir.

### Firewall Ayarları

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 2. Proje Kurulumu

### Proje Dizini Oluşturma

```bash
sudo mkdir -p /opt/seismic-network
sudo chown $USER:$USER /opt/seismic-network
cd /opt/seismic-network
```

### Projeyi Klonlama veya Yükleme

```bash
# Git ile (eğer repo varsa)
git clone <your-repo-url> .

# Veya dosyaları manuel olarak yükleyin (scp/sftp ile)
```

### Python Virtual Environment Kurulumu

```bash
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## 3. Konfigürasyon

### config.py Düzenleme

```bash
nano config.py
```

Önemli ayarlar:

```python
HOST = "0.0.0.0"  # Tüm interface'lerden dinle
PORT = 8000
DATABASE_URL = "sqlite:///./seismic_network.db"
LOG_LEVEL = "INFO"
```

### Veritabanı Başlatma

```bash
source venv/bin/activate
python3 -c "from models import init_db; init_db()"
```

## 4. GlobalQuake 0.11.1 Kurulumu

GlobalQuake, gerçek zamanlı sismik sensör verilerini Seedlink protokolü üzerinden alır ve deprem tespiti yapar.

### GlobalQuake Dizini Oluşturma

```bash
sudo mkdir -p /opt/globalquake
sudo chown $USER:$USER /opt/globalquake
cd /opt/globalquake
```

### GlobalQuake 0.11.1 İndirme

```bash
# GitHub'dan v0.11.0_pre-1 veya v0.11.1 sürümünü indirin
wget https://github.com/xspanger3770/GlobalQuake/releases/download/v0.11.0_pre-1/GlobalQuake-0.11.0_pre-1.jar

# Veya en son 0.11.x sürümünü kontrol edin:
# https://github.com/xspanger3770/GlobalQuake/releases
```

### GlobalQuake Konfigürasyonu

GlobalQuake ilk çalıştırmada otomatik olarak yapılandırma dosyaları oluşturur:

```bash
# İlk çalıştırma (GUI açılacak, kapatabilirsiniz)
java -jar GlobalQuake-0.11.0_pre-1.jar

# Headless mode için (sunucuda GUI olmadan)
java -Djava.awt.headless=true -jar GlobalQuake-0.11.0_pre-1.jar
```

**Önemli Notlar:**
- GlobalQuake varsayılan olarak GUI modunda çalışır
- VDS'de headless mode kullanmanız önerilir
- Log dosyaları `logs/gq-info/` dizininde oluşturulur
- Backend'imiz bu log dosyalarını izleyerek deprem tespitlerini alır

### GlobalQuake Systemd Service

```bash
sudo nano /etc/systemd/system/globalquake.service
```

İçerik:

```ini
[Unit]
Description=GlobalQuake Seismic Detection
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/globalquake
ExecStart=/usr/bin/java -Xmx2G -Djava.awt.headless=true -jar GlobalQuake-0.11.0_pre-1.jar
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### GlobalQuake İzinleri

```bash
sudo chown -R www-data:www-data /opt/globalquake
sudo chmod -R 755 /opt/globalquake
```

### GlobalQuake Service Başlatma

```bash
sudo systemctl daemon-reload
sudo systemctl enable globalquake
sudo systemctl start globalquake
sudo systemctl status globalquake
```

### GlobalQuake Loglarını İzleme

```bash
# Service logları
sudo journalctl -u globalquake -f

# GlobalQuake uygulama logları
tail -f /opt/globalquake/logs/gq-info/*.log
```

## 5. Systemd Service Kurulumu (Backend)

### Service Dosyası Oluşturma

```bash
sudo nano /etc/systemd/system/seismic-network.service
```

İçerik:

```ini
[Unit]
Description=Seismic Network Backend API
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/seismic-network
Environment="PATH=/opt/seismic-network/venv/bin"
ExecStart=/opt/seismic-network/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### Dizin İzinlerini Ayarlama

```bash
sudo chown -R www-data:www-data /opt/seismic-network
sudo chmod -R 755 /opt/seismic-network
```

### Service'i Etkinleştirme

```bash
sudo systemctl daemon-reload
sudo systemctl enable seismic-network
sudo systemctl start seismic-network
sudo systemctl status seismic-network
```

## 5. Nginx Reverse Proxy Kurulumu

### Nginx Konfigürasyonu

```bash
sudo nano /etc/nginx/sites-available/seismic-network
```

İçerik:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Alan adınızı buraya yazın

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400;
    }
}
```

### Nginx'i Etkinleştirme

```bash
sudo ln -s /etc/nginx/sites-available/seismic-network /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## 6. SSL Sertifikası (Let's Encrypt)

```bash
sudo certbot --nginx -d your-domain.com
```

Certbot otomatik yenileme:

```bash
sudo systemctl status certbot.timer
```

## 7. Monitoring ve Log Yönetimi

### Logları İzleme

```bash
# Backend logları
sudo journalctl -u seismic-network -f

# Nginx logları
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Veritabanı Yedekleme

Günlük yedekleme için cron job:

```bash
crontab -e
```

Ekle:

```
0 2 * * * cp /opt/seismic-network/seismic_network.db /opt/seismic-network/backups/seismic_network_$(date +\%Y\%m\%d).db
```

Yedek dizini oluştur:

```bash
mkdir -p /opt/seismic-network/backups
```

## 8. Güvenlik Önerileri

### Fail2ban Kurulumu

```bash
sudo apt install fail2ban -y
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### SSH Güvenliği

```bash
sudo nano /etc/ssh/sshd_config
```

Önerilen ayarlar:

```
PermitRootLogin no
PasswordAuthentication no  # SSH key kullanıyorsanız
Port 2222  # Varsayılan port değiştirme (opsiyonel)
```

```bash
sudo systemctl restart sshd
```

## 9. Test ve Doğrulama

### Backend Sağlık Kontrolü

```bash
curl http://localhost:8000/api
```

Beklenen yanıt:

```json
{
  "service": "Seismic Network API",
  "version": "1.0.0",
  "status": "running"
}
```

### Dashboard Erişimi

Tarayıcıda:

```
http://your-domain.com/dashboard
```

### WebSocket Testi

```bash
# wscat kurulumu
npm install -g wscat

# WebSocket bağlantı testi
wscat -c ws://your-domain.com/ws/sensor/test-device
```

## 10. Güncelleme ve Bakım

### Backend Güncelleme

```bash
cd /opt/seismic-network
git pull  # veya yeni dosyaları yükle
source venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart seismic-network
```

### Veritabanı Migrasyonu

Eğer model değişiklikleri varsa:

```bash
source venv/bin/activate
python3 -c "from models import Base, engine; Base.metadata.create_all(bind=engine)"
```

## 11. Sorun Giderme

### Service Çalışmıyor

```bash
sudo systemctl status seismic-network
sudo journalctl -u seismic-network -n 50
```

### Port Kullanımda

```bash
sudo lsof -i :8000
sudo netstat -tulpn | grep 8000
```

### Disk Doldu

```bash
# Eski logları temizle
sudo journalctl --vacuum-time=7d

# Eski veritabanı yedeklerini temizle
find /opt/seismic-network/backups -name "*.db" -mtime +30 -delete
```

## 12. Performans Optimizasyonu

### Uvicorn Workers

`main.py` çalıştırma komutunu değiştir:

```bash
ExecStart=/opt/seismic-network/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### Nginx Caching (Opsiyonel)

```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /status {
    proxy_cache api_cache;
    proxy_cache_valid 200 10s;
    # ... diğer proxy ayarları
}
```

## Veri Kaynakları

Backend şu kaynaklardan gerçek zamanlı deprem verisi çeker:

- **USGS:** Global depremler
- **EMSC:** Avrupa-Akdeniz bölgesi
- **KOERI:** Türkiye depremleri (Kandilli Rasathanesi)
- **AFAD:** Türkiye resmi deprem verileri
- **Mobil Cihazlar:** Kullanıcı telefonlarından sensör verileri

## Destek ve İletişim

Sorun bildirimi veya öneriler için:

- GitHub Issues
- Discord sunucusu
- Email: support@example.com

---

**Son Güncelleme:** Mart 2026
