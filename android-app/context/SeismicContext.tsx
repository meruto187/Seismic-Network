import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SERVER_URL = 'wss://seismic.meruto.com.tr';
export const DEVICE_ID = 'android_' + Math.random().toString(36).substring(7);
const SENSOR_INTERVAL_MS = 100;

export interface SensorData {
  x: number;
  y: number;
  z: number;
  magnitude: number;
}

export interface EqAlert {
  type: string;
  alert_type: string;
  message: string;
  priority: string;
  color: string;
  timestamp: string;
}

export interface GlobalEvent {
  id: string;
  source: string;
  timestamp: string;
  latitude: number;
  longitude: number;
  depth_km: number;
  magnitude: number;
  magnitude_type: string;
  place: string;
  url?: string;
}

export interface ChatMessage {
  id: string;
  device_id: string;
  text: string;
  timestamp: string;
}

export interface Settings {
  minMagnitude: number;
  notifySound: boolean;
  notifyVibration: boolean;
  maxDistanceKm: number;
}

const DEFAULT_SETTINGS: Settings = {
  minMagnitude: 2.0,
  notifySound: true,
  notifyVibration: true,
  maxDistanceKm: 500,
};

interface SeismicContextType {
  isConnected: boolean;
  isMonitoring: boolean;
  sensorData: SensorData;
  alerts: EqAlert[];
  globalEvents: GlobalEvent[];
  chatMessages: ChatMessage[];
  networkStatus: { active_devices: number; websocket_connections: number; global_events: number };
  locationError: string | null;
  userLocation: { lat: number; lon: number } | null;
  regionId: string;
  settings: Settings;
  toggleMonitoring: () => void;
  sendChatMessage: (text: string) => void;
  updateSettings: (s: Partial<Settings>) => void;
  submitReport: (mmi: number) => Promise<boolean>;
  refreshEvents: () => Promise<void>;
}

const SeismicContext = createContext<SeismicContextType | null>(null);

export const useSeismic = () => {
  const ctx = useContext(SeismicContext);
  if (!ctx) throw new Error('useSeismic must be used within SeismicProvider');
  return ctx;
};

const PROFANITY_LIST = ['küfür1', 'küfür2', 'shit', 'fuck', 'spam'];
const filterMessage = (text: string) => {
  let filtered = text;
  PROFANITY_LIST.forEach(word => {
    const re = new RegExp(word, 'gi');
    filtered = filtered.replace(re, '*'.repeat(word.length));
  });
  return filtered;
};

export const SeismicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData>({ x: 0, y: 0, z: 0, magnitude: 0 });
  const [alerts, setAlerts] = useState<EqAlert[]>([]);
  const [globalEvents, setGlobalEvents] = useState<GlobalEvent[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [networkStatus, setNetworkStatus] = useState({ active_devices: 0, websocket_connections: 0, global_events: 0 });
  const [locationError, setLocationError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [regionId, setRegionId] = useState('global');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sensorSubscription = useRef<{ remove: () => void } | null>(null);
  const lastSensorRef = useRef<SensorData>({ x: 0, y: 0, z: 0, magnitude: 0 });
  const chatRateRef = useRef<number[]>([]);

  useEffect(() => {
    AsyncStorage.getItem('settings').then(val => {
      if (val) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(val) });
    });
    requestPermissions();
    fetchGlobalEvents();
    fetchNetworkStatus();
    const statusInterval = setInterval(fetchNetworkStatus, 15000);
    const eventsInterval = setInterval(fetchGlobalEvents, 60000);
    return () => {
      clearInterval(statusInterval);
      clearInterval(eventsInterval);
    };
  }, []);

  useEffect(() => {
    if (isMonitoring) {
      connectWebSocket();
      startAccelerometer();
    } else {
      stopAll();
    }
    return () => stopAll();
  }, [isMonitoring]);

  const requestPermissions = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation({ lat, lon });
        const region = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
        if (region.length > 0) {
          const r = region[0];
          setRegionId(`${r.country || ''}_${r.region || r.city || ''}`.replace(/\s+/g, '_'));
        }
      } else {
        setLocationError('Konum izni verilmedi');
      }
    } catch (e) {
      setLocationError('Konum alınamadı');
    }
  };

  const fetchGlobalEvents = async () => {
    try {
      const res = await fetch(`https://seismic.meruto.com.tr/events?event_type=global&limit=100`);
      const data = await res.json();
      setGlobalEvents(data.global_events || []);
    } catch (_) {}
  };

  const fetchNetworkStatus = async () => {
    try {
      const res = await fetch('https://seismic.meruto.com.tr/status');
      const data = await res.json();
      setNetworkStatus({
        active_devices: data.active_devices || 0,
        websocket_connections: data.websocket_connections || 0,
        global_events: data.global_events || 0,
      });
    } catch (_) {}
  };

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const ws = new WebSocket(`${SERVER_URL}/ws/sensor/${DEVICE_ID}`);
    ws.onopen = () => {
      setIsConnected(true);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'alert') {
          setAlerts(prev => [msg, ...prev.slice(0, 49)]);
        } else if (msg.type === 'chat') {
          setChatMessages(prev => [...prev.slice(-99), {
            id: Date.now().toString(),
            device_id: msg.device_id || 'unknown',
            text: filterMessage(msg.text || ''),
            timestamp: msg.timestamp || new Date().toISOString(),
          }]);
        }
      } catch (_) {}
    };
    ws.onerror = () => setIsConnected(false);
    ws.onclose = () => {
      setIsConnected(false);
      if (isMonitoring) {
        reconnectTimer.current = setTimeout(connectWebSocket, 5000);
      }
    };
    wsRef.current = ws;
  };

  const startAccelerometer = () => {
    Accelerometer.setUpdateInterval(SENSOR_INTERVAL_MS);
    sensorSubscription.current = Accelerometer.addListener((data: { x: number; y: number; z: number }) => {
      const magnitude = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);
      const sd = { ...data, magnitude };
      lastSensorRef.current = sd;
      setSensorData(sd);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'sensor_data',
          device_id: DEVICE_ID,
          x: data.x, y: data.y, z: data.z,
          magnitude,
          region_id: regionId,
          timestamp: new Date().toISOString(),
        }));
      }
    });
  };

  const stopAll = () => {
    sensorSubscription.current?.remove();
    sensorSubscription.current = null;
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    setIsConnected(false);
  };

  const toggleMonitoring = useCallback(() => {
    setIsMonitoring(prev => !prev);
  }, []);

  const sendChatMessage = useCallback((text: string) => {
    const now = Date.now();
    chatRateRef.current = chatRateRef.current.filter(t => now - t < 10000);
    if (chatRateRef.current.length >= 3) return;
    chatRateRef.current.push(now);
    const filtered = filterMessage(text.trim());
    if (!filtered || filtered.length > 300) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        device_id: DEVICE_ID,
        text: filtered,
        timestamp: new Date().toISOString(),
      }));
    }
  }, []);

  const updateSettings = useCallback((s: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...s };
      AsyncStorage.setItem('settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const submitReport = useCallback(async (mmi: number): Promise<boolean> => {
    try {
      const res = await fetch('https://seismic.meruto.com.tr/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: DEVICE_ID,
          mmi,
          latitude: userLocation?.lat,
          longitude: userLocation?.lon,
          region_id: regionId,
          timestamp: new Date().toISOString(),
        }),
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }, [userLocation, regionId]);

  return (
    <SeismicContext.Provider
      value={{
        isConnected,
        isMonitoring,
        sensorData,
        alerts,
        globalEvents,
        chatMessages,
        networkStatus,
        locationError,
        userLocation,
        regionId,
        settings,
        toggleMonitoring,
        sendChatMessage,
        updateSettings,
        submitReport,
        refreshEvents: fetchGlobalEvents,
      }}
    >
      {children}
    </SeismicContext.Provider>
  );
};
