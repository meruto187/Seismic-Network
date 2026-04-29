import os
from typing import Dict, Any

class Config:
    DATABASE_URL: str = "sqlite:///./seismic_network.db"
    
    THRESHOLD_SIMPLE_G: float = 0.1
    THRESHOLD_SIMPLE_MS2: float = 0.98
    
    STA_WINDOW_SECONDS: float = 1.0
    LTA_WINDOW_SECONDS: float = 30.0
    STA_LTA_TRIGGER_RATIO: float = 3.0
    
    GEOFENCING_RADIUS_KM: float = 50.0
    
    TIME_WINDOW_SECONDS: int = 5
    MIN_DEVICES_FOR_TRIGGER: int = 3
    
    GLOBAL_SYNC_INTERVAL_SECONDS: int = 30
    GLOBAL_SYNC_LOOKBACK_MINUTES: int = 10
    
    TIME_TOLERANCE_MINUTES: int = 2
    DISTANCE_TOLERANCE_KM: float = 100.0
    MIN_GLOBAL_MAGNITUDE: float = 2.5
    
    USGS_API_URL: str = "https://earthquake.usgs.gov/fdsnws/event/1/query"
    EMSC_API_URL: str = "https://www.seismicportal.eu/fdsnws/event/1/query"
    
    ALERT_LEVELS: Dict[str, Dict[str, Any]] = {
        "EARLY_WARNING": {
            "color": "orange",
            "message": "Yerel sensörler sarsıntı algıladı, resmi doğrulama bekleniyor",
            "priority": "HIGH"
        },
        "CONFIRMED_QUAKE": {
            "color": "red",
            "message": "Deprem doğrulandı! GlobalQuake verileriyle eşleşti",
            "priority": "CRITICAL"
        },
        "POTENTIAL_QUAKE": {
            "color": "yellow",
            "message": "Potansiyel sarsıntı tespit edildi, izleniyor",
            "priority": "MEDIUM"
        },
        "DISTANT_QUAKE": {
            "color": "blue",
            "message": "Uzak bölgede deprem tespit edildi (bilgi amaçlı)",
            "priority": "LOW"
        }
    }
    
    WEBSOCKET_PING_INTERVAL: int = 20
    WEBSOCKET_PING_TIMEOUT: int = 10
    
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")

    ADMIN_KEY: str = os.getenv("ADMIN_KEY", "changeme-admin-key-2025")

    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")
    GOOGLE_REDIRECT_URI: str = os.getenv("GOOGLE_REDIRECT_URI", "https://seismic.meruto.com.tr/auth/callback")

    JWT_SECRET: str = os.getenv("JWT_SECRET", "seismic-jwt-secret-change-me")
    JWT_EXPIRE_DAYS: int = 30

    ADMIN_EMAILS: list = os.getenv("ADMIN_EMAILS", "mertsucu806@gmail.com").split(",")

    WS_RATE_LIMIT_PER_SECOND: int = 5
    WS_MAX_MESSAGE_BYTES: int = 4096

config = Config()
