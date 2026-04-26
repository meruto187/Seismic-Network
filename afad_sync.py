import asyncio
import logging
import httpx
from datetime import datetime, timedelta, timezone
from typing import List, Dict
from sqlalchemy.orm import Session

from models import GlobalEvent, SessionLocal
from config import config

logger = logging.getLogger(__name__)

class AFADSync:
    def __init__(self):
        self.url = "https://deprem.afad.gov.tr/EventData/GetEventsByFilter"
        self.running = False
        self.poll_interval = 60
        self.lookback_minutes = 120
        
    async def fetch_afad_events(self) -> List[Dict]:
        try:
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(minutes=self.lookback_minutes)
            
            event_filter = {
                "EventSearchFilterList": [
                    {"FilterType": 8, "Value": start_date.isoformat()},
                    {"FilterType": 9, "Value": end_date.isoformat()},
                ],
                "Skip": 0,
                "Take": 100,
                "SortDescriptor": {"field": "eventDate", "dir": "desc"},
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.url, json=event_filter)
                response.raise_for_status()
                
                data = response.json()
                events = []
                
                for item in data.get('result', []):
                    event = self._parse_afad_event(item)
                    if event:
                        events.append(event)
                
                logger.info(f"AFAD: Fetched {len(events)} events")
                return events
                
        except httpx.HTTPError as e:
            logger.error(f"AFAD HTTP error: {e}")
            return []
        except Exception as e:
            logger.error(f"AFAD fetch error: {e}")
            return []
    
    def _parse_afad_event(self, item: Dict) -> Dict:
        try:
            event_id = f"afad_{item.get('eventID', item.get('id', 'unknown'))}"
            
            timestamp_str = item.get('eventDate') or item.get('date')
            timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
            timestamp = timestamp.astimezone(timezone.utc).replace(tzinfo=None)
            
            lat = float(item.get('latitude') or item.get('lat'))
            lon = float(item.get('longitude') or item.get('lon'))
            depth = float(item.get('depth', 0))
            magnitude = float(item.get('magnitude') or item.get('mag'))
            magnitude_type = item.get('magnitudeType', 'ML')
            location = item.get('location') or item.get('place', 'Unknown')
            
            return {
                'id': event_id,
                'source': 'AFAD',
                'timestamp': timestamp,
                'latitude': lat,
                'longitude': lon,
                'depth_km': depth,
                'magnitude': magnitude,
                'magnitude_type': magnitude_type,
                'place': location,
                'url': f"https://deprem.afad.gov.tr/event-detail/{item.get('eventID', '')}"
            }
            
        except (ValueError, KeyError, TypeError) as e:
            logger.debug(f"AFAD parse error for item {item}: {e}")
            return None
    
    def save_events(self, events: List[Dict], db: Session):
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
            logger.info(f"AFAD: Saved {saved_count} new events")
        
        return saved_count
    
    async def sync_loop(self):
        self.running = True
        logger.info("AFAD sync loop started")
        
        while self.running:
            try:
                events = await self.fetch_afad_events()
                
                if events:
                    db = SessionLocal()
                    try:
                        self.save_events(events, db)
                    finally:
                        db.close()
                
                await asyncio.sleep(self.poll_interval)
                
            except Exception as e:
                logger.error(f"AFAD sync loop error: {e}")
                await asyncio.sleep(self.poll_interval)
        
        logger.info("AFAD sync stopped")
    
    def stop(self):
        self.running = False
