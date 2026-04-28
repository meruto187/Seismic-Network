import React from 'react'
import { useSeismic } from '../context/SeismicContext'
import { Bell, BellOff, MessageSquare, Sliders } from 'lucide-react'

const MAG_OPTIONS = [1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0]

const Toggle: React.FC<{ label: string; description: string; checked: boolean; onChange: (v: boolean) => void; icon?: React.ReactNode }> = ({
  label, description, checked, onChange, icon
}) => (
  <div className="flex items-center justify-between py-4">
    <div className="flex items-center gap-3">
      {icon && <div className="text-slate-400">{icon}</div>}
      <div>
        <p className="text-sm font-medium text-slate-200">{label}</p>
        <p className="text-xs text-slate-500 mt-0.5">{description}</p>
      </div>
    </div>
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-600'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  </div>
)

const SettingsScreen: React.FC = () => {
  const { settings, updateSettings, networkStatus, isConnected } = useSeismic()

  return (
    <div className="h-full overflow-y-auto p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-100">Ayarlar</h1>
        <p className="text-sm text-slate-400">Uygulama tercihlerini düzenle</p>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-2">
        <h2 className="text-sm font-semibold text-slate-300 mb-4 flex items-center gap-2">
          <Sliders size={15} /> Filtreler
        </h2>

        <div>
          <p className="text-sm text-slate-400 mb-3">Minimum Büyüklük Eşiği</p>
          <div className="flex flex-wrap gap-2">
            {MAG_OPTIONS.map(mag => (
              <button
                key={mag}
                onClick={() => updateSettings({ minMagnitude: mag })}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  settings.minMagnitude === mag
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                M{mag.toFixed(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 px-5 divide-y divide-slate-700">
        <h2 className="text-sm font-semibold text-slate-300 py-4 flex items-center gap-2">
          <Bell size={15} /> Bildirimler
        </h2>
        <Toggle
          label="Deprem Uyarıları"
          description="Yeni uyarı geldiğinde masaüstü bildirimi göster"
          checked={settings.notifyAlerts}
          onChange={v => updateSettings({ notifyAlerts: v })}
          icon={<Bell size={16} />}
        />
        <Toggle
          label="Sohbet Mesajları"
          description="Odak dışındayken yeni mesajlar için bildirim"
          checked={settings.notifyChat}
          onChange={v => updateSettings({ notifyChat: v })}
          icon={<MessageSquare size={16} />}
        />
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-4">Sunucu & Bağlantı</h2>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">WebSocket URL</label>
            <input
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-blue-500"
              value={settings.serverUrl}
              onChange={e => updateSettings({ serverUrl: e.target.value })}
              placeholder="wss://..."
            />
          </div>
          <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${
            isConnected ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400 animate-pulse'}`} />
            {isConnected ? 'Bağlantı aktif' : 'Bağlantı yok'}
            <span className="ml-auto text-slate-500">
              {networkStatus.active_devices} cihaz · {networkStatus.websocket_connections} bağlantı
            </span>
          </div>
        </div>
      </div>

      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Uygulama Hakkında</h2>
        <div className="space-y-1 text-sm text-slate-400">
          <p>Merkezi Sismik Ağ — Masaüstü İstemcisi</p>
          <p className="text-xs text-slate-600">v1.0.0 · Electron + React · MIT Lisansı</p>
        </div>
      </div>
    </div>
  )
}

export default SettingsScreen
