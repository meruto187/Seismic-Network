import React, { useState } from 'react'
import { SeismicProvider } from './context/SeismicContext'
import { useSeismic } from './context/SeismicContext'
import DashboardScreen from './screens/DashboardScreen'
import QuakeListScreen from './screens/QuakeListScreen'
import QuakeMapScreen from './screens/QuakeMapScreen'
import ChatScreen from './screens/ChatScreen'
import SettingsScreen from './screens/SettingsScreen'
import { Activity, List, Map, MessageSquare, Settings, Wifi, WifiOff } from 'lucide-react'

type Tab = 'dashboard' | 'list' | 'map' | 'chat' | 'settings'

const NAV_ITEMS: { id: Tab; label: string; Icon: React.FC<{ size?: number; className?: string }> }[] = [
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

const Sidebar: React.FC<{ active: Tab; onSelect: (t: Tab) => void }> = ({ active, onSelect }) => {
  const { isConnected, alerts } = useSeismic()
  return (
    <aside className="w-16 flex flex-col bg-slate-900 border-r border-slate-700 items-center py-4 gap-2 shrink-0">
      <div className="mb-4">
        <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-sm">S</div>
      </div>
      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          title={label}
          onClick={() => onSelect(id)}
          className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors
            ${active === id
              ? 'bg-red-600 text-white'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}
        >
          <Icon size={18} />
          <span className="text-[9px] leading-none">{label}</span>
          {id === 'dashboard' && alerts.length > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-400" />
          )}
        </button>
      ))}

      <div className="mt-auto">
        {isConnected
          ? <Wifi size={16} className="text-green-400" title="Bağlı" />
          : <WifiOff size={16} className="text-red-400 animate-pulse" title="Bağlantı yok" />}
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
