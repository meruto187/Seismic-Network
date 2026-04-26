import asyncio
import logging
import httpx
from datetime import datetime, timezone
from bs4 import BeautifulSoup
import re
from typing import List, Dict, Optional
from sqlalchemy.orm import Session

from models import GlobalEvent, SessionLocal
from config import config

logger = logging.getLogger(__name__)

class KOERISync:
    def __init__(self):
        self.url = "https://www.koeri.boun.edu.tr/scripts/lst0.asp"
        self.running = False
        self.poll_interval = 60
        
    async def fetch_koeri_events(self) -> List[Dict]:
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(self.url)
                response.raise_for_status()
                
                soup = BeautifulSoup(response.text, 'html.parser')
                pre_tag = soup.find('pre')
                
                if not pre_tag:
                    logger.warning("KOERI: No <pre> tag found in response")
                    return []
                
                lines = pre_tag.get_text().strip().split('\n')
                events = []
                
                for line in lines:
                    line = line.strip()
                    if not line or line.startswith('-') or 'Date' in line or 'Tarih' in line:
                        continue
                    
                    event = self._parse_koeri_line(line)
                    if event:
                        events.append(event)
                
                logger.info(f"KOERI: Fetched {len(events)} events")
                return events
                
        except httpx.HTTPError as e:
            logger.error(f"KOERI HTTP error: {e}")
            return []
        except Exception as e:
            logger.error(f"KOERI fetch error: {e}")
            return []
    
    def _parse_koeri_line(self, line: str) -> Optional[Dict]:
        try:
            parts = line.split()
            if len(parts) < 9:
                return None
            
            date_str = parts[0]
            time_str = parts[1]
            lat = float(parts[2])
            lon = float(parts[3])
            depth = float(parts[4])
            magnitude_type = parts[5]
            magnitude = float(parts[6])
            location = ' '.join(parts[8:])
            
            timestamp_str = f"{date_str} {time_str}"
            timestamp = datetime.strptime(timestamp_str, "%Y.%m.%d %H:%M:%S")
            timestamp = timestamp.replace(tzinfo=timezone.utc).replace(tzinfo=None)
            
            event_id = f"koeri_{timestamp_str.replace(' ', '_').replace(':', '').replace('.', '')}"
            
            return {
                'id': event_id,
                'source': 'KOERI',
                'timestamp': timestamp,
                'latitude': lat,
                'longitude': lon,
                'depth_km': depth,
                'magnitude': magnitude,
                'magnitude_type': magnitude_type,
                'place': location,
                'url': self.url
            }
            
        except (ValueError, IndexError) as e:
            logger.debug(f"KOERI parse error for line '{line}': {e}")
            return None
    
    def save_events(self, events: List[Dict], db: Session):
        saved_count = 0
        for event_data in events:
            existing = db.query(GlobalEvent).filter(GlobalEvent.id == event_data['id']).first()
            if existing:
                continue
            
            event = GlobalEvent(**event_data)
            db.add(event)
            saved_count += 1
        
        if saved_count > 0:
            db.commit()
            logger.info(f"KOERI: Saved {saved_count} new events")
        
        return saved_count
    
    async def sync_loop(self):
        self.running = True
        logger.info("KOERI sync loop started")
        
        while self.running:
            try:
                events = await self.fetch_koeri_events()
                
                if events:
                    db = SessionLocal()
                    try:
                        self.save_events(events, db)
                    finally:
                        db.close()
                
                await asyncio.sleep(self.poll_interval)
                
            except Exception as e:
                logger.error(f"KOERI sync loop error: {e}")
                await asyncio.sleep(self.poll_interval)
        
        logger.info("KOERI sync stopped")
    
    def stop(self):
        self.running = False
