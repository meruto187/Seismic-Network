from sqlalchemy import create_engine, Column, Integer, Float, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from config import config

Base = declarative_base()

class Device(Base):
    __tablename__ = "devices"
    
    id = Column(String, primary_key=True)
    first_seen = Column(DateTime, default=datetime.utcnow)
    last_seen = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    region_id = Column(String, nullable=True)
    last_latitude = Column(Float, nullable=True)
    last_longitude = Column(Float, nullable=True)
    is_active = Column(Boolean, default=True)
    
    sensor_data = relationship("SensorData", back_populates="device")

class SensorData(Base):
    __tablename__ = "sensor_data"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    device_id = Column(String, ForeignKey("devices.id"), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    x = Column(Float, nullable=False)
    y = Column(Float, nullable=False)
    z = Column(Float, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    region_id = Column(String, nullable=True)
    magnitude = Column(Float, nullable=True)
    sta_lta_ratio = Column(Float, nullable=True)
    
    device = relationship("Device", back_populates="sensor_data")

class LocalEvent(Base):
    __tablename__ = "local_events"
    
    id = Column(String, primary_key=True)
    timestamp = Column(DateTime, nullable=False)
    region = Column(String, nullable=True)
    center_lat = Column(Float, nullable=True)
    center_lon = Column(Float, nullable=True)
    triggered_devices = Column(Text, nullable=False)
    device_count = Column(Integer, nullable=False)
    avg_magnitude = Column(Float, nullable=False)
    max_magnitude = Column(Float, nullable=False)
    status = Column(String, nullable=False)
    detection_method = Column(String, nullable=False)
    
    alerts = relationship("Alert", back_populates="local_event")

class GlobalEvent(Base):
    __tablename__ = "global_events"
    
    id = Column(String, primary_key=True)
    source = Column(String, nullable=False)
    timestamp = Column(DateTime, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    depth_km = Column(Float, nullable=True)
    magnitude = Column(Float, nullable=False)
    magnitude_type = Column(String, nullable=True)
    place = Column(String, nullable=True)
    url = Column(String, nullable=True)
    fetched_at = Column(DateTime, default=datetime.utcnow)
    
    alerts = relationship("Alert", back_populates="global_event")

class Alert(Base):
    __tablename__ = "alerts"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    alert_type = Column(String, nullable=False)
    local_event_id = Column(String, ForeignKey("local_events.id"), nullable=True)
    global_event_id = Column(String, ForeignKey("global_events.id"), nullable=True)
    message = Column(Text, nullable=False)
    priority = Column(String, nullable=False)
    color = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    resolved_at = Column(DateTime, nullable=True)
    
    local_event = relationship("LocalEvent", back_populates="alerts")
    global_event = relationship("GlobalEvent", back_populates="alerts")

engine = create_engine(config.DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
