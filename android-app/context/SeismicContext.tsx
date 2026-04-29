import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as Location from 'expo-location';
import * as Battery from 'expo-battery';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const SERVER_URL = 'wss://seismic.meruto.com.tr';
export const DEVICE_ID = 'android_' + Math.random().toString(36).substring(7);

const SENSOR_INTERVAL_MS = 100;
const UI_THROTTLE_MS = 1000;
const WS_SEND_INTERVAL_FG = 1000;
const WS_SEND_INTERVAL_BG = 5000;

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
  autoStartOnCharging: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  minMagnitude: 2.0,
  notifySound: true,
  notifyVibration: true,
  maxDistanceKm: 500,
  autoStartOnCharging: true,
};

interface SeismicContextType {
  isConnected: boolean;
  isMonitoring: boolean;
  isCharging: boolean;
  sensorData: SensorData;
  sensorHistory: number[];
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
  const [isCharging, setIsCharging] = useState(false);
  const [sensorData, setSensorData] = useState<SensorData>({ x: 0, y: 0, z: 0, magnitude: 0 });
  const [sensorHistory, setSensorHistory] = useState<number[]>(Array(60).fill(0));
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
  const chatRateRef = useRef<number[]>([]);
  const isMonitoringRef = useRef(false);
  const settingsRef = useRef(settings);
  const regionIdRef = useRef(regionId);
  const userLocationRef = useRef(userLocation);
  const appStateRef = useRef<AppStateStatus>('active');

  const peakBufferRef = useRef<SensorData>({ x: 0, y: 0, z: 0, magnitude: 0 });
  const lastUiUpdateRef = useRef(0);
  const lastWsSendRef = useRef(0);

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { regionIdRef.current = regionId; }, [regionId]);
  useEffect(() => { userLocationRef.current = userLocation; }, [userLocation]);
  useEffect(() => { isMonitoringRef.current = isMonitoring; }, [isMonitoring]);

  useEffect(() => {
    AsyncStorage.getItem('settings').then(val => {
      if (val) {
        const saved = { ...DEFAULT_SETTINGS, ...JSON.parse(val) };
        setSettings(saved);
        settingsRef.current = saved;
      }
    });
    requestPermissions();
    fetchGlobalEvents();
    fetchNetworkStatus();
    checkBattery();
    connectWebSocket();

    const statusInterval = setInterval(fetchNetworkStatus, 30000);
    const eventsInterval = setInterval(fetchGlobalEvents, 120000);

    const appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
      appStateRef.current = state;
    });

    const batteryStateSub = Battery.addBatteryStateListener(({ batteryState }) => {
      const charging = batteryState === Battery.BatteryState.CHARGING ||
        batteryState === Battery.BatteryState.FULL;
      setIsCharging(charging);
      if (charging && settingsRef.current.autoStartOnCharging && !isMonitoringRef.current) {
        setIsMonitoring(true);
      } else if (!charging && settingsRef.current.autoStartOnCharging && isMonitoringRef.current) {
        setIsMonitoring(false);
      }
    });

    return () => {
      clearInterval(statusInterval);
      clearInterval(eventsInterval);
      appStateSub.remove();
      batteryStateSub?.remove();
    };
  }, []);

  useEffect(() => {
    if (isMonitoring) {
      startAccelerometer();
    } else {
      stopAccelerometer();
    }
  }, [isMonitoring]);

  const checkBattery = async () => {
    try {
      const state = await Battery.getBatteryStateAsync();
      const charging = state === Battery.BatteryState.CHARGING || state === Battery.BatteryState.FULL;
      setIsCharging(charging);
      const saved = settingsRef.current;
      if (charging && saved.autoStartOnCharging) {
        setIsMonitoring(true);
      }
    } catch (_) {}
  };

  const requestPermissions = async () => {
    try {
      Notifications.requestPermissionsAsync().catch(() => {});
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setUserLocation({ lat, lon });
        userLocationRef.current = { lat, lon };
        try {
          const region = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
          if (region.length > 0) {
            const r = region[0];
            const rid = `${r.country || ''}_${r.region || r.city || ''}`.replace(/\s+/g, '_');
            setRegionId(rid);
            regionIdRef.current = rid;
          }
        } catch (_) {}
      } else {
        setLocationError('Konum izni verilmedi');
      }
    } catch (_) {
      setLocationError('Konum alınamadı');
    }
  };

  const fetchGlobalEvents = async () => {
    try {
      const res = await fetch('https://seismic.meruto.com.tr/events?event_type=global&limit=100');
      const data = await res.json();
      const events: GlobalEvent[] = data.global_events || [];
      setGlobalEvents(events);
      AsyncStorage.setItem('cached_events', JSON.stringify({ ts: Date.now(), events })).catch(() => {});
    } catch (_) {
      try {
        const cached = await AsyncStorage.getItem('cached_events');
        if (cached) {
          const { events } = JSON.parse(cached) as { ts: number; events: GlobalEvent[] };
          setGlobalEvents(events);
        }
      } catch (_2) {}
    }
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
          if (settingsRef.current.notifySound && (msg.priority === 'HIGH' || msg.priority === 'CRITICAL')) {
            Notifications.scheduleNotificationAsync({
              content: {
                title: `⚠️ Sismik Uyarı — ${msg.alert_type || 'Deprem'}`,
                body: msg.message || 'Yeni sismik aktivite tespit edildi',
                sound: true,
                priority: Notifications.AndroidNotificationPriority.HIGH,
              },
              trigger: null,
            }).catch(() => {});
          }
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
      if (isMonitoringRef.current) {
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

      if (magnitude > peakBufferRef.current.magnitude) {
        peakBufferRef.current = sd;
      }

      const now = Date.now();
      const isBackground = appStateRef.current !== 'active';
      const sendInterval = isBackground ? WS_SEND_INTERVAL_BG : WS_SEND_INTERVAL_FG;

      if (now - lastWsSendRef.current >= sendInterval) {
        lastWsSendRef.current = now;
        const peak = peakBufferRef.current;
        peakBufferRef.current = { x: 0, y: 0, z: 0, magnitude: 0 };

        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'sensor_data',
            device_id: DEVICE_ID,
            x: peak.x, y: peak.y, z: peak.z,
            magnitude: peak.magnitude,
            latitude: userLocationRef.current?.lat ?? null,
            longitude: userLocationRef.current?.lon ?? null,
            region_id: regionIdRef.current,
            timestamp: new Date().toISOString(),
          }));
        }
      }

      if (!isBackground && now - lastUiUpdateRef.current >= UI_THROTTLE_MS) {
        lastUiUpdateRef.current = now;
        setSensorData(sd);
        setSensorHistory(prev => [...prev.slice(1), magnitude]);
      }
    });
  };

  const stopAccelerometer = () => {
    sensorSubscription.current?.remove();
    sensorSubscription.current = null;
  };

  const stopAll = () => {
    stopAccelerometer();
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
      settingsRef.current = next;
      AsyncStorage.setItem('settings', JSON.stringify(next));
      return next;
    });
  }, []);

  const submitReport = useCallback(async (mmi: number): Promise<boolean> => {
    try {
      const loc = userLocationRef.current;
      const res = await fetch('https://seismic.meruto.com.tr/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: DEVICE_ID,
          mmi,
          latitude: loc?.lat,
          longitude: loc?.lon,
          region_id: regionIdRef.current,
          timestamp: new Date().toISOString(),
        }),
      });
      return res.ok;
    } catch (_) {
      return false;
    }
  }, []);

  return (
    <SeismicContext.Provider
      value={{
        isConnected,
        isMonitoring,
        isCharging,
        sensorData,
        sensorHistory,
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
