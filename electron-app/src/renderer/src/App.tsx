import React, { useState } from 'react'
import { SeismicProvider } from './context/SeismicContext'
import { useSeismic } from './context/SeismicContext'
import DashboardScreen from './screens/DashboardScreen'
import QuakeListScreen from './screens/QuakeListScreen'
import QuakeMapScreen from './screens/QuakeMapScreen'
import ChatScreen from './screens/ChatScreen'
import SettingsScreen from './screens/SettingsScreen'
import { Activity, List, Map, MessageSquare, Settings, Wifi, WifiOff, LucideIcon } from 'lucide-react'

type Tab = 'dashboard' | 'list' | 'map' | 'chat' | 'settings'

const NAV_ITEMS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Gösterge', Icon: Activity },
  { id: 'list', label: 'Depremler', Icon: List },
  { id: 'map', label: 'Harita', Icon: Map },
  { id: 'chat', label: 'Sohbet', Icon: MessageSquare },
  { id: 'settings', label: 'Ayarlar', Icon: Settings },
]

const SCREENS: Record<Tab, React.FC> = {
  dashboard: DashboardScreen,
  list: QuakeListScreen,
  map: QuakeMapScreen,
  chat: ChatScreen,
  settings: SettingsScreen,
}

const SeismicLogo: React.FC = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="#7f1d1d" />
    <polyline
      points="2,16 6,16 8,10 10,22 12,13 14,19 16,8 18,24 20,14 22,18 24,16 30,16"
      stroke="#fca5a5"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
)

const Sidebar: React.FC<{ active: Tab; onSelect: (t: Tab) => void }> = ({ active, onSelect }) => {
  const { isConnected, alerts } = useSeismic()
  return (
    <aside className="w-[60px] flex flex-col bg-slate-950 border-r border-slate-800 items-center py-4 gap-1 shrink-0">
      <div className="mb-5">
        <SeismicLogo />
      </div>
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          title={label}
          onClick={() => onSelect(id)}
          className={`relative w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150
            ${active === id
              ? 'bg-red-700/80 text-red-100 shadow-lg shadow-red-900/40'
              : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'}`}
        >
          <Icon size={17} />
          <span className="text-[8px] leading-none font-medium tracking-wide">{label}</span>
          {id === 'dashboard' && alerts.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-400" />
          )}
        </button>
      ))}

      <div className="mt-auto pb-1">
        <div title={isConnected ? 'Bağlı' : 'Bağlantı yok'}>
          {isConnected
            ? <Wifi size={14} className="text-green-500" />
            : <WifiOff size={14} className="text-red-500 animate-pulse" />}
        </div>
      </div>
    </aside>
  )
}

const Shell: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const Screen = SCREENS[activeTab]

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar active={activeTab} onSelect={setActiveTab} />
      <main className="flex-1 overflow-hidden">
        <Screen />
      </main>
    </div>
  )
}

const App: React.FC = () => (
  <SeismicProvider>
    <Shell />
  </SeismicProvider>
)

export default App
