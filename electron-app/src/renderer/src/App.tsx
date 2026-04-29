import React, { useState, useEffect, createContext, useContext } from 'react'
import { SeismicProvider } from './context/SeismicContext'
import { useSeismic } from './context/SeismicContext'
import DashboardScreen from './screens/DashboardScreen'
import QuakeListScreen from './screens/QuakeListScreen'
import QuakeMapScreen from './screens/QuakeMapScreen'
import ChatScreen from './screens/ChatScreen'
import SettingsScreen from './screens/SettingsScreen'
import { Activity, List, Map, MessageSquare, Settings, Wifi, WifiOff, LucideIcon, Sun, Moon } from 'lucide-react'

type Theme = 'dark' | 'light'
const ThemeCtx = createContext<{ theme: Theme; toggleTheme: () => void }>({ theme: 'dark', toggleTheme: () => {} })
export const useTheme = () => useContext(ThemeCtx)

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
  const { theme, toggleTheme } = useTheme()
  const isLight = theme === 'light'

  return (
    <aside
      className="w-[60px] flex flex-col items-center py-4 gap-1 shrink-0"
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      <div className="mb-5">
        <SeismicLogo />
      </div>

      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          title={label}
          onClick={() => onSelect(id)}
          className="relative w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150"
          style={
            active === id
              ? { background: 'rgba(230,57,70,0.18)', color: '#e63946', boxShadow: '0 2px 12px rgba(230,57,70,0.18)' }
              : { color: 'var(--text-3)' }
          }
          onMouseEnter={e => { if (active !== id) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-2)' }}
          onMouseLeave={e => { if (active !== id) (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-3)' }}
        >
          <Icon size={17} />
          <span className="text-[8px] leading-none font-semibold tracking-wide">{label}</span>
          {id === 'dashboard' && alerts.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
          )}
        </button>
      ))}

      <div className="mt-auto flex flex-col items-center gap-2 pb-1">
        <button
          title={isLight ? 'Karanlık moda geç' : 'Aydınlık moda geç'}
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={{ color: 'var(--text-3)' }}
        >
          {isLight ? <Moon size={15} /> : <Sun size={15} />}
        </button>
        <div title={isConnected ? 'Bağlı' : 'Bağlantı yok'} className="flex items-center justify-center">
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
    <div className="flex h-screen w-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Sidebar active={activeTab} onSelect={setActiveTab} />
      <main className="flex-1 overflow-hidden">
        <Screen />
      </main>
    </div>
  )
}

const App: React.FC = () => {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')

  useEffect(() => {
    const saved = localStorage.getItem('ui-theme') as 'dark' | 'light' | null
    if (saved) { setTheme(saved); applyTheme(saved) }
  }, [])

  const applyTheme = (t: 'dark' | 'light') => {
    const root = document.documentElement
    if (t === 'light') root.classList.add('light')
    else root.classList.remove('light')
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
    localStorage.setItem('ui-theme', next)
  }

  return (
    <ThemeCtx.Provider value={{ theme, toggleTheme }}>
      <SeismicProvider>
        <Shell />
      </SeismicProvider>
    </ThemeCtx.Provider>
  )
}

export default App
