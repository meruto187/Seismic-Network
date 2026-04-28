import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'

export const SERVER_URL = 'wss://seismic.meruto.com.tr'
export const DEVICE_ID = 'desktop_' + Math.random().toString(36).substring(7)

export interface GlobalEvent {
  id: string
  source: string
  timestamp: string
  latitude: number
  longitude: number
  depth_km: number
  magnitude: number
  magnitude_type: string
  place: string
  url?: string
}

export interface EqAlert {
  type: string
  alert_type: string
  message: string
  priority: string
  color: string
  timestamp: string
}

export interface ChatMessage {
  id: string
  device_id: string
  text: string
  timestamp: string
}

export interface NetworkStatus {
  active_devices: number
  websocket_connections: number
  global_events: number
}

export interface Settings {
  minMagnitude: number
  notifyAlerts: boolean
  notifyChat: boolean
  serverUrl: string
}

const DEFAULT_SETTINGS: Settings = {
  minMagnitude: 2.0,
  notifyAlerts: true,
  notifyChat: false,
  serverUrl: SERVER_URL,
}

interface SeismicContextType {
  isConnected: boolean
  globalEvents: GlobalEvent[]
  alerts: EqAlert[]
  chatMessages: ChatMessage[]
  networkStatus: NetworkStatus
  settings: Settings
  selectedEvent: GlobalEvent | null
  sendChatMessage: (text: string) => void
  updateSettings: (s: Partial<Settings>) => void
  refreshEvents: () => Promise<void>
  selectEvent: (e: GlobalEvent | null) => void
}

const SeismicContext = createContext<SeismicContextType | null>(null)

export const useSeismic = () => {
  const ctx = useContext(SeismicContext)
  if (!ctx) throw new Error('useSeismic must be used within SeismicProvider')
  return ctx
}

const PROFANITY_LIST = ['shit', 'fuck', 'spam']
const filterMessage = (text: string) => {
  let out = text
  PROFANITY_LIST.forEach(w => {
    out = out.replace(new RegExp(w, 'gi'), '*'.repeat(w.length))
  })
  return out
}

export const SeismicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false)
  const [globalEvents, setGlobalEvents] = useState<GlobalEvent[]>([])
  const [alerts, setAlerts] = useState<EqAlert[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({ active_devices: 0, websocket_connections: 0, global_events: 0 })
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [selectedEvent, setSelectedEvent] = useState<GlobalEvent | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chatRateRef = useRef<number[]>([])
  const settingsRef = useRef(settings)
  const reconnectingRef = useRef(false)

  useEffect(() => { settingsRef.current = settings }, [settings])

  useEffect(() => {
    const saved = localStorage.getItem('settings')
    if (saved) {
      const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
      setSettings(parsed)
      settingsRef.current = parsed
    }
    fetchGlobalEvents()
    fetchNetworkStatus()
    connectWebSocket()

    const statusInterval = setInterval(fetchNetworkStatus, 30000)
    const eventsInterval = setInterval(fetchGlobalEvents, 120000)

    return () => {
      clearInterval(statusInterval)
      clearInterval(eventsInterval)
      wsRef.current?.close()
    }
  }, [])

  const fetchGlobalEvents = async () => {
    try {
      const res = await fetch('https://seismic.meruto.com.tr/events?event_type=global&limit=200')
      const data = await res.json()
      setGlobalEvents(data.global_events || [])
    } catch (_) {}
  }

  const fetchNetworkStatus = async () => {
    try {
      const res = await fetch('https://seismic.meruto.com.tr/status')
      const data = await res.json()
      setNetworkStatus({
        active_devices: data.active_devices || 0,
        websocket_connections: data.websocket_connections || 0,
        global_events: data.global_events || 0,
      })
    } catch (_) {}
  }

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    if (reconnectingRef.current) return
    reconnectingRef.current = true

    const ws = new WebSocket(`${settingsRef.current.serverUrl}/ws/sensor/${DEVICE_ID}`)
    ws.onopen = () => {
      setIsConnected(true)
      reconnectingRef.current = false
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data)
        if (msg.type === 'alert') {
          setAlerts(prev => [msg, ...prev.slice(0, 49)])
          if (settingsRef.current.notifyAlerts) {
            ;(window as any).electronAPI?.showNotification(
              `⚠️ Deprem Uyarısı`,
              msg.message || 'Yeni uyarı'
            )
          }
        } else if (msg.type === 'chat') {
          setChatMessages(prev => [...prev.slice(-99), {
            id: Date.now().toString(),
            device_id: msg.device_id || 'unknown',
            text: filterMessage(msg.text || ''),
            timestamp: msg.timestamp || new Date().toISOString(),
          }])
          if (settingsRef.current.notifyChat && msg.device_id !== DEVICE_ID) {
            ;(window as any).electronAPI?.showNotification(
              `💬 ${msg.device_id?.slice(0, 12)}`,
              msg.text || ''
            )
          }
        }
      } catch (_) {}
    }
    ws.onerror = () => {
      setIsConnected(false)
      reconnectingRef.current = false
    }
    ws.onclose = () => {
      setIsConnected(false)
      reconnectingRef.current = false
      reconnectTimer.current = setTimeout(connectWebSocket, 5000)
    }
    wsRef.current = ws
  }

  const sendChatMessage = useCallback((text: string) => {
    const now = Date.now()
    chatRateRef.current = chatRateRef.current.filter(t => now - t < 10000)
    if (chatRateRef.current.length >= 3) return
    chatRateRef.current.push(now)
    const filtered = filterMessage(text.trim())
    if (!filtered || filtered.length > 300) return
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat',
        device_id: DEVICE_ID,
        text: filtered,
        timestamp: new Date().toISOString(),
      }))
    }
  }, [])

  const updateSettings = useCallback((s: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...s }
      settingsRef.current = next
      localStorage.setItem('settings', JSON.stringify(next))
      return next
    })
  }, [])

  const selectEvent = useCallback((e: GlobalEvent | null) => {
    setSelectedEvent(e)
  }, [])

  return (
    <SeismicContext.Provider value={{
      isConnected,
      globalEvents,
      alerts,
      chatMessages,
      networkStatus,
      settings,
      selectedEvent,
      sendChatMessage,
      updateSettings,
      refreshEvents: fetchGlobalEvents,
      selectEvent,
    }}>
      {children}
    </SeismicContext.Provider>
  )
}
