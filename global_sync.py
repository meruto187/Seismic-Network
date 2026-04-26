import httpx
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Optional
import logging
from config import config
from models import GlobalEvent, SessionLocal

logging.basicConfig(level=config.LOG_LEVEL)
logger = logging.getLogger(__name__)

class GlobalQuakeSync:
    """
    Resmi deprem verilerini (USGS ve EMSC) senkronize eder.
    
    Not: GlobalQuake.net (https://globalquake.net/) farklı bir açık kaynak 
    sismik ağ projesidir. Şu anda USGS ve EMSC resmi kaynaklarını kullanıyoruz.
    GlobalQuake.net API'si gelecekte eklenebilir.
    """
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
        self.is_running = False
    
    async def fetch_usgs_events(self) -> List[Dict]:
        try:
            start_time = datetime.utcnow() - timedelta(minutes=config.GLOBAL_SYNC_LOOKBACK_MINUTES)
            
            params = {
                'format': 'geojson',
                'minmagnitude': config.MIN_GLOBAL_MAGNITUDE,
                'orderby': 'time',
                'starttime': start_time.isoformat()
            }
            
            response = await self.client.get(config.USGS_API_URL, params=params)
            response.raise_for_status()
            
            data = response.json()
            events = []
            
            for feature in data.get('features', []):
                props = feature['properties']
                coords = feature['geometry']['coordinates']
                
                event = {
                    'id': f"usgs_{feature['id']}",
                    'source': 'USGS',
                    'timestamp': datetime.fromtimestamp(props['time'] / 1000, tz=timezone.utc).replace(tzinfo=None),
                    'latitude': coords[1],
                    'longitude': coords[0],
                    'depth_km': coords[2] if len(coords) > 2 else None,
                    'magnitude': props['mag'],
                    'magnitude_type': props.get('magType'),
                    'place': props.get('place'),
                    'url': props.get('url')
                }
                events.append(event)
            
            logger.info(f"Fetched {len(events)} events from USGS")
            return events
            
        except Exception as e:
            logger.error(f"Error fetching USGS events: {e}")
            return []
    
    async def fetch_emsc_events(self) -> List[Dict]:
        try:
            start_time = datetime.utcnow() - timedelta(minutes=config.GLOBAL_SYNC_LOOKBACK_MINUTES)
            
            params = {
                'format': 'json',
                'minmag': config.MIN_GLOBAL_MAGNITUDE,
                'orderby': 'time',
                'start': start_time.strftime('%Y-%m-%dT%H:%M:%S')
            }
            
            response = await self.client.get(config.EMSC_API_URL, params=params)
            response.raise_for_status()
            
            data = response.json()
            events = []
            
            for feature in data.get('features', []):
                props = feature['properties']
                coords = feature['geometry']['coordinates']
                
                time_str = props.get('time')
                if time_str:
                    event_time = datetime.fromisoformat(time_str.replace('Z', '+00:00')).astimezone(timezone.utc).replace(tzinfo=None)
                else:
                    continue
                
                event = {
                    'id': f"emsc_{feature.get('id', props.get('unid'))}",
                    'source': 'EMSC',
                    'timestamp': event_time,
                    'latitude': coords[1],
                    'longitude': coords[0],
                    'depth_km': coords[2] if len(coords) > 2 else None,
                    'magnitude': props.get('mag'),
                    'magnitude_type': props.get('magtype'),
                    'place': props.get('flynn_region'),
                    'url': f"https://www.emsc-csem.org/Earthquake/earthquake.php?id={props.get('unid')}"
                }
                events.append(event)
            
            logger.info(f"Fetched {len(events)} events from EMSC")
            return events
            
        except Exception as e:
            logger.error(f"Error fetching EMSC events: {e}")
            return []
    
    async def fetch_all_events(self) -> List[Dict]:
        usgs_task = self.fetch_usgs_events()
        emsc_task = self.fetch_emsc_events()
        
        usgs_events, emsc_events = await asyncio.gather(usgs_task, emsc_task)
        
        all_events = usgs_events + emsc_events
        
        unique_events = {}
        for event in all_events:
            key = (
                round(event['latitude'], 2),
                round(event['longitude'], 2),
                event['timestamp'].replace(second=0, microsecond=0)
            )
            
            if key not in unique_events or event['source'] == 'USGS':
                unique_events[key] = event
        
        return list(unique_events.values())
    
    def save_events_to_db(self, events: List[Dict]):
        db = SessionLocal()
        try:
            for event_data in events:
                existing = db.query(GlobalEvent).filter(
                    GlobalEvent.id == event_data['id']
                ).first()
                
                if not existing:
                    event = GlobalEvent(**event_data)
                    db.add(event)
            
            db.commit()
            logger.info(f"Saved {len(events)} global events to database")
            
        except Exception as e:
            logger.error(f"Error saving events to database: {e}")
            db.rollback()
        finally:
            db.close()
    
    async def sync_loop(self):
        self.is_running = True
        logger.info("GlobalQuake sync loop started")
        
        while self.is_running:
            try:
                events = await self.fetch_all_events()
                
                if events:
                    self.save_events_to_db(events)
                
                await asyncio.sleep(config.GLOBAL_SYNC_INTERVAL_SECONDS)
                
            except Exception as e:
                logger.error(f"Error in sync loop: {e}")
                await asyncio.sleep(config.GLOBAL_SYNC_INTERVAL_SECONDS)
    
    async def start(self):
        asyncio.create_task(self.sync_loop())
    
    async def stop(self):
        self.is_running = False
        await self.client.aclose()
        logger.info("GlobalQuake sync stopped")

global_sync = GlobalQuakeSync()
