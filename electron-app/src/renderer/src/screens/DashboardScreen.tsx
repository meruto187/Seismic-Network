import React from 'react'
import { useSeismic } from '../context/SeismicContext'
import { Activity, AlertTriangle, Globe, Monitor, Radio, Wifi, WifiOff } from 'lucide-react'

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH: 'bg-orange-500',
  MEDIUM: 'bg-yellow-500',
  LOW: 'bg-blue-500',
}

const getMagColor = (mag: number) => {
  if (mag >= 6.0) return 'text-red-400'
  if (mag >= 4.0) return 'text-orange-400'
  if (mag >= 2.0) return 'text-yellow-400'
  return 'text-green-400'
}

const timeAgo = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'şimdi'
  if (mins < 60) return `${mins} dk`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} sa`
  return `${Math.floor(hrs / 24)} gün`
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color?: string }> = ({ icon, label, value, color = 'text-slate-100' }) => (
  <div className="bg-slate-800 rounded-xl p-4 flex items-center gap-4 border border-slate-700">
    <div className="text-slate-400">{icon}</div>
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  </div>
)

const DashboardScreen: React.FC = () => {
  const { isConnected, networkStatus, alerts, globalEvents } = useSeismic()

  const last24h = globalEvents.filter(e =>
    Date.now() - new Date(e.timestamp).getTime() < 86400000
  )
  const significantToday = last24h.filter(e => e.magnitude >= 4.0)
  const recentAlerts = alerts.slice(0, 8)
  const recentQuakes = [...globalEvents]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 8)

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Gösterge Paneli</h1>
          <p className="text-sm text-slate-400">Merkezi Sismik Ağ</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${
          isConnected
            ? 'bg-green-900/30 border-green-700 text-green-400'
            : 'bg-red-900/30 border-red-700 text-red-400'
        }`}>
          {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {isConnected ? 'Bağlı' : 'Bağlantı Yok'}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<Monitor size={20} />} label="Aktif Cihaz" value={networkStatus.active_devices} color="text-blue-400" />
        <StatCard icon={<Radio size={20} />} label="WS Bağlantısı" value={networkStatus.websocket_connections} color="text-purple-400" />
        <StatCard icon={<Globe size={20} />} label="Son 24s Deprem" value={last24h.length} color="text-yellow-400" />
        <StatCard icon={<AlertTriangle size={20} />} label="Önemli (M4+)" value={significantToday.length} color="text-red-400" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
            <AlertTriangle size={16} className="text-red-400" />
            <h2 className="font-semibold text-slate-100">Son Uyarılar</h2>
          </div>
          <div className="divide-y divide-slate-700">
            {recentAlerts.length === 0 ? (
              <p className="text-center text-slate-500 py-8 text-sm">Uyarı yok</p>
            ) : recentAlerts.map((a, i) => (
              <div key={i} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${PRIORITY_COLOR[a.priority] || 'bg-slate-500'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 leading-snug">{a.message}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{timeAgo(a.timestamp)} önce</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
            <Activity size={16} className="text-blue-400" />
            <h2 className="font-semibold text-slate-100">Son Depremler</h2>
          </div>
          <div className="divide-y divide-slate-700">
            {recentQuakes.length === 0 ? (
              <p className="text-center text-slate-500 py-8 text-sm">Veri yükleniyor...</p>
            ) : recentQuakes.map(q => (
              <div key={q.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`text-lg font-bold w-10 text-right shrink-0 ${getMagColor(q.magnitude)}`}>
                  {q.magnitude.toFixed(1)}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-200 truncate">{q.place || 'Konum bilinmiyor'}</p>
                  <p className="text-xs text-slate-500">{timeAgo(q.timestamp)} · {q.source}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardScreen
