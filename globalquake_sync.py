import asyncio
import logging
import os
import json
from datetime import datetime, timezone
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from pathlib import Path
import re

from models import GlobalEvent, SessionLocal
from config import config

logger = logging.getLogger(__name__)

class GlobalQuakeSync:
    """
    GlobalQuake 0.11.1 entegrasyonu için sync modülü.
    
    GlobalQuake'i VDS'de ayrı bir Java uygulaması olarak çalıştırıp,
    tespit edilen depremleri log dosyalarından veya event export'undan okur.
    
    Entegrasyon Stratejileri:
    1. Log dosyası izleme (logs/gq-info/)
    2. Event export dosyası izleme (eğer GlobalQuake export özelliği varsa)
    3. GlobalQuake Server API (eğer server modunda çalışıyorsa)
    """
    
    def __init__(self, globalquake_dir: str = "/opt/globalquake"):
        self.globalquake_dir = Path(globalquake_dir)
        self.log_dir = self.globalquake_dir / "logs" / "gq-info"
        self.events_file = self.globalquake_dir / "events" / "detected_events.json"
        self.running = False
        self.poll_interval = 10
        self.last_processed_position = {}
        
    async def watch_log_files(self) -> List[Dict]:
        """
        GlobalQuake log dosyalarını izleyip yeni deprem tespitlerini parse eder.
        """
        events = []
        
        if not self.log_dir.exists():
            logger.warning(f"GlobalQuake log directory not found: {self.log_dir}")
            return events
        
        try:
            log_files = sorted(self.log_dir.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)
            
            for log_file in log_files[:3]:
                new_events = await self._parse_log_file(log_file)
                events.extend(new_events)
            
            return events
            
        except Exception as e:
            logger.error(f"GlobalQuake log watch error: {e}")
            return []
    
    async def _parse_log_file(self, log_file: Path) -> List[Dict]:
        """
        GlobalQuake log dosyasından deprem tespitlerini parse eder.
        
        Log formatı örneği (tahmini):
        [2026-03-25 16:30:45] EARTHQUAKE DETECTED: M4.2, Lat: 38.5, Lon: 27.3, Depth: 10km
        """
        events = []
        
        try:
            file_key = str(log_file)
            last_position = self.last_processed_position.get(file_key, 0)
            
            with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
                f.seek(last_position)
                new_lines = f.readlines()
                self.last_processed_position[file_key] = f.tell()
            
            for line in new_lines:
                event = self._parse_earthquake_line(line)
                if event:
                    events.append(event)
            
        except Exception as e:
            logger.debug(f"Error parsing log file {log_file}: {e}")
        
        return events
    
    def _parse_earthquake_line(self, line: str) -> Optional[Dict]:
        """
        Log satırından deprem bilgisini parse eder.
        
        Örnek formatlar:
        - "EARTHQUAKE DETECTED: M4.2, Lat: 38.5, Lon: 27.3, Depth: 10km"
        - "New earthquake: magnitude=4.2 latitude=38.5 longitude=27.3 depth=10.0"
        """
        try:
            if "EARTHQUAKE" not in line.upper() and "DETECTED" not in line.upper():
                return None
            
            magnitude_match = re.search(r'M[=:\s]*([\d.]+)', line, re.IGNORECASE)
            lat_match = re.search(r'Lat[=:\s]*([-\d.]+)', line, re.IGNORECASE)
            lon_match = re.search(r'Lon[=:\s]*([-\d.]+)', line, re.IGNORECASE)
            depth_match = re.search(r'Depth[=:\s]*([\d.]+)', line, re.IGNORECASE)
            
            if not (magnitude_match and lat_match and lon_match):
                return None
            
            magnitude = float(magnitude_match.group(1))
            latitude = float(lat_match.group(1))
            longitude = float(lon_match.group(1))
            depth = float(depth_match.group(1)) if depth_match else 10.0
            
            timestamp_match = re.search(r'\[([\d-]+ [\d:]+)\]', line)
            if timestamp_match:
                timestamp_str = timestamp_match.group(1)
                timestamp = datetime.strptime(timestamp_str, "%Y-%m-%d %H:%M:%S")
                timestamp = timestamp.replace(tzinfo=timezone.utc).replace(tzinfo=None)
            else:
                timestamp = datetime.utcnow()
            
            event_id = f"globalquake_{timestamp.strftime('%Y%m%d%H%M%S')}_{int(latitude*100)}_{int(longitude*100)}"
            
            return {
                'id': event_id,
                'source': 'GlobalQuake',
                'timestamp': timestamp,
                'latitude': latitude,
                'longitude': longitude,
                'depth_km': depth,
                'magnitude': magnitude,
                'magnitude_type': 'ML',
                'place': f"GlobalQuake Detection ({latitude:.2f}, {longitude:.2f})",
                'url': None
            }
            
        except (ValueError, AttributeError) as e:
            logger.debug(f"Failed to parse earthquake line: {line.strip()} - {e}")
            return None
    
    async def watch_events_file(self) -> List[Dict]:
        """
        GlobalQuake'in export ettiği JSON event dosyasını okur.
        """
        events = []
        
        if not self.events_file.exists():
            return events
        
        try:
            with open(self.events_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                for item in data:
                    event = self._parse_json_event(item)
                    if event:
                        events.append(event)
            
            return events
            
        except Exception as e:
            logger.debug(f"Error reading GlobalQuake events file: {e}")
            return []
    
    def _parse_json_event(self, item: Dict) -> Optional[Dict]:
        """
        GlobalQuake JSON event formatını parse eder.
        """
        try:
            event_id = f"globalquake_{item.get('id', item.get('timestamp', 'unknown'))}"
            
            timestamp_str = item.get('timestamp') or item.get('time')
            if isinstance(timestamp_str, str):
                timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                timestamp = timestamp.astimezone(timezone.utc).replace(tzinfo=None)
            else:
                timestamp = datetime.utcnow()
            
            return {
                'id': event_id,
                'source': 'GlobalQuake',
                'timestamp': timestamp,
                'latitude': float(item['latitude']),
                'longitude': float(item['longitude']),
                'depth_km': float(item.get('depth', 10.0)),
                'magnitude': float(item['magnitude']),
                'magnitude_type': item.get('magnitude_type', 'ML'),
                'place': item.get('location', f"GlobalQuake Detection"),
                'url': None
            }
            
        except (KeyError, ValueError, TypeError) as e:
            logger.debug(f"Failed to parse GlobalQuake JSON event: {e}")
            return None
    
    def save_events(self, events: List[Dict], db: Session):
        """
        GlobalQuake'den gelen olayları veritabanına kaydeder.
        """
        saved_count = 0
        for event_data in events:
            if not event_data:
                continue
            
            existing = db.query(GlobalEvent).filter(GlobalEvent.id == event_data['id']).first()
            if existing:
                continue
            
            event = GlobalEvent(**event_data)
            db.add(event)
            saved_count += 1
        
        if saved_count > 0:
            db.commit()
            logger.info(f"GlobalQuake: Saved {saved_count} new events")
        
        return saved_count
    
    async def sync_loop(self):
        """
        GlobalQuake entegrasyonu için ana döngü.
        """
        self.running = True
        logger.info("GlobalQuake sync loop started")
        
        if not self.globalquake_dir.exists():
            logger.warning(f"GlobalQuake directory not found: {self.globalquake_dir}")
            logger.info("GlobalQuake sync will remain idle until directory is created")
        
        while self.running:
            try:
                events = []
                
                log_events = await self.watch_log_files()
                events.extend(log_events)
                
                file_events = await self.watch_events_file()
                events.extend(file_events)
                
                if events:
                    db = SessionLocal()
                    try:
                        self.save_events(events, db)
                    finally:
                        db.close()
                
                await asyncio.sleep(self.poll_interval)
                
            except Exception as e:
                logger.error(f"GlobalQuake sync loop error: {e}")
                await asyncio.sleep(self.poll_interval)
        
        logger.info("GlobalQuake sync stopped")
    
    def stop(self):
        self.running = False
