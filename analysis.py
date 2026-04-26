import numpy as np
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from collections import deque
import math
import uuid
from config import config
from models import SensorData, LocalEvent, Alert, GlobalEvent, SessionLocal
import json

class SignalProcessor:
    def __init__(self):
        self.sta_buffer = {}
        self.lta_buffer = {}
        self.recent_data = deque(maxlen=1000)
    
    def calculate_magnitude(self, x: float, y: float, z: float) -> float:
        return math.sqrt(x**2 + y**2 + z**2)
    
    def simple_threshold_check(self, magnitude: float) -> bool:
        return magnitude > config.THRESHOLD_SIMPLE_MS2
    
    def update_sta_lta(self, device_id: str, magnitude: float, timestamp: datetime) -> float:
        if device_id not in self.sta_buffer:
            self.sta_buffer[device_id] = deque(maxlen=int(config.STA_WINDOW_SECONDS * 100))
            self.lta_buffer[device_id] = deque(maxlen=int(config.LTA_WINDOW_SECONDS * 100))
        
        self.sta_buffer[device_id].append(magnitude)
        self.lta_buffer[device_id].append(magnitude)
        
        if len(self.sta_buffer[device_id]) < 10 or len(self.lta_buffer[device_id]) < 100:
            return 0.0
        
        sta = np.mean(list(self.sta_buffer[device_id]))
        lta = np.mean(list(self.lta_buffer[device_id]))
        
        if lta == 0:
            return 0.0
        
        return sta / lta
    
    def sta_lta_check(self, ratio: float) -> bool:
        return ratio > config.STA_LTA_TRIGGER_RATIO
    
    def process_sensor_data(self, data: Dict) -> Tuple[float, float, bool, bool]:
        magnitude = self.calculate_magnitude(data['x'], data['y'], data['z'])
        
        sta_lta_ratio = self.update_sta_lta(
            data['device_id'], 
            magnitude, 
            data['timestamp']
        )
        
        simple_triggered = self.simple_threshold_check(magnitude)
        sta_lta_triggered = self.sta_lta_check(sta_lta_ratio)
        
        return magnitude, sta_lta_ratio, simple_triggered, sta_lta_triggered

class GeofenceAnalyzer:
    def __init__(self):
        self.recent_triggers = deque(maxlen=10000)
    
    def haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def add_trigger(self, device_id: str, timestamp: datetime, latitude: Optional[float], 
                   longitude: Optional[float], region_id: Optional[str], magnitude: float,
                   detection_method: str):
        self.recent_triggers.append({
            'device_id': device_id,
            'timestamp': timestamp,
            'latitude': latitude,
            'longitude': longitude,
            'region_id': region_id,
            'magnitude': magnitude,
            'detection_method': detection_method
        })
    
    def find_clustered_events(self) -> List[Dict]:
        now = datetime.utcnow()
        cutoff_time = now - timedelta(seconds=config.TIME_WINDOW_SECONDS)
        
        recent = [t for t in self.recent_triggers if t['timestamp'] > cutoff_time]
        
        if len(recent) < config.MIN_DEVICES_FOR_TRIGGER:
            return []
        
        events = []
        processed_devices = set()
        
        for trigger in recent:
            if trigger['device_id'] in processed_devices:
                continue
            
            cluster = [trigger]
            cluster_devices = {trigger['device_id']}
            
            for other in recent:
                if other['device_id'] in cluster_devices:
                    continue
                
                if self._are_nearby(trigger, other):
                    cluster.append(other)
                    cluster_devices.add(other['device_id'])
            
            if len(cluster) >= config.MIN_DEVICES_FOR_TRIGGER:
                event = self._create_event_from_cluster(cluster)
                events.append(event)
                processed_devices.update(cluster_devices)
        
        return events
    
    def _are_nearby(self, trigger1: Dict, trigger2: Dict) -> bool:
        if trigger1.get('region_id') and trigger2.get('region_id'):
            if trigger1['region_id'] == trigger2['region_id']:
                return True
        
        if (trigger1.get('latitude') and trigger1.get('longitude') and 
            trigger2.get('latitude') and trigger2.get('longitude')):
            distance = self.haversine_distance(
                trigger1['latitude'], trigger1['longitude'],
                trigger2['latitude'], trigger2['longitude']
            )
            return distance <= config.GEOFENCING_RADIUS_KM
        
        return False
    
    def _create_event_from_cluster(self, cluster: List[Dict]) -> Dict:
        event_id = str(uuid.uuid4())
        
        latitudes = [t['latitude'] for t in cluster if t.get('latitude')]
        longitudes = [t['longitude'] for t in cluster if t.get('longitude')]
        
        center_lat = np.mean(latitudes) if latitudes else None
        center_lon = np.mean(longitudes) if longitudes else None
        
        region = cluster[0].get('region_id')
        if not region and len(set(t.get('region_id') for t in cluster if t.get('region_id'))) > 0:
            region = max(set(t.get('region_id') for t in cluster if t.get('region_id')), 
                        key=lambda x: sum(1 for t in cluster if t.get('region_id') == x))
        
        magnitudes = [t['magnitude'] for t in cluster]
        avg_magnitude = np.mean(magnitudes)
        max_magnitude = np.max(magnitudes)
        
        detection_methods = set(t['detection_method'] for t in cluster)
        detection_method = ', '.join(sorted(detection_methods))
        
        return {
            'id': event_id,
            'timestamp': cluster[0]['timestamp'],
            'region': region,
            'center_lat': center_lat,
            'center_lon': center_lon,
            'triggered_devices': json.dumps([t['device_id'] for t in cluster]),
            'device_count': len(cluster),
            'avg_magnitude': avg_magnitude,
            'max_magnitude': max_magnitude,
            'status': 'POTENTIAL_QUAKE',
            'detection_method': detection_method
        }

class EventMatcher:
    def __init__(self):
        pass
    
    def match_local_with_global(self, local_event: LocalEvent, db) -> Optional[GlobalEvent]:
        time_min = local_event.timestamp - timedelta(minutes=config.TIME_TOLERANCE_MINUTES)
        time_max = local_event.timestamp + timedelta(minutes=config.TIME_TOLERANCE_MINUTES)
        
        global_events = db.query(GlobalEvent).filter(
            GlobalEvent.timestamp >= time_min,
            GlobalEvent.timestamp <= time_max,
            GlobalEvent.magnitude >= config.MIN_GLOBAL_MAGNITUDE
        ).all()
        
        if not local_event.center_lat or not local_event.center_lon:
            return None
        
        for global_event in global_events:
            distance = self._calculate_distance(
                local_event.center_lat, local_event.center_lon,
                global_event.latitude, global_event.longitude
            )
            
            if distance <= config.DISTANCE_TOLERANCE_KM:
                return global_event
        
        return None
    
    def _calculate_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        R = 6371.0
        lat1_rad = math.radians(lat1)
        lat2_rad = math.radians(lat2)
        delta_lat = math.radians(lat2 - lat1)
        delta_lon = math.radians(lon2 - lon1)
        
        a = math.sin(delta_lat / 2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon / 2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        return R * c
    
    def determine_alert_type(self, local_event: LocalEvent, global_event: Optional[GlobalEvent]) -> str:
        if global_event:
            return "CONFIRMED_QUAKE"
        else:
            return "EARLY_WARNING"
    
    def create_alert(self, local_event: LocalEvent, global_event: Optional[GlobalEvent], db) -> Alert:
        alert_type = self.determine_alert_type(local_event, global_event)
        alert_config = config.ALERT_LEVELS[alert_type]
        
        if global_event:
            message = f"{alert_config['message']} - Magnitude: {global_event.magnitude}, Yer: {global_event.place}"
        else:
            message = f"{alert_config['message']} - {local_event.device_count} cihaz, Ortalama büyüklük: {local_event.avg_magnitude:.2f} m/s²"
        
        alert = Alert(
            alert_type=alert_type,
            local_event_id=local_event.id,
            global_event_id=global_event.id if global_event else None,
            message=message,
            priority=alert_config['priority'],
            color=alert_config['color']
        )
        
        db.add(alert)
        db.commit()
        
        return alert

signal_processor = SignalProcessor()
geofence_analyzer = GeofenceAnalyzer()
event_matcher = EventMatcher()
