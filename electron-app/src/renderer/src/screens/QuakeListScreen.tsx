import React, { useState, useMemo } from 'react'
import { useSeismic, GlobalEvent } from '../context/SeismicContext'
import { Search, RefreshCw, ExternalLink } from 'lucide-react'

type TimeFilter = '24h' | '7d' | '30d' | 'all'

const getMagColor = (mag: number) => {
  if (mag >= 6.0) return 'bg-red-500'
  if (mag >= 4.0) return 'bg-orange-500'
  if (mag >= 2.0) return 'bg-yellow-500'
  return 'bg-green-500'
}

const timeAgo = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'şimdi'
  if (mins < 60) return `${mins} dk önce`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} sa önce`
  return `${Math.floor(hrs / 24)} gün önce`
}

const QuakeListScreen: React.FC = () => {
  const { globalEvents, settings, refreshEvents, selectEvent } = useSeismic()
  const [search, setSearch] = useState('')
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('7d')
  const [sourceFilter, setSourceFilter] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const sources = useMemo(() => [...new Set(globalEvents.map(e => e.source))], [globalEvents])

  const getTimeThreshold = () => {
    const now = Date.now()
    switch (timeFilter) {
      case '24h': return now - 86400000
      case '7d': return now - 7 * 86400000
      case '30d': return now - 30 * 86400000
      default: return 0
    }
  }

  const filtered = useMemo(() => {
    const thr = getTimeThreshold()
    return globalEvents
      .filter(e => e.magnitude >= settings.minMagnitude)
      .filter(e => !sourceFilter || e.source === sourceFilter)
      .filter(e => !search || (e.place || '').toLowerCase().includes(search.toLowerCase()))
      .filter(e => timeFilter === 'all' || new Date(e.timestamp).getTime() >= thr)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [globalEvents, search, timeFilter, sourceFilter, settings.minMagnitude])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshEvents()
    setRefreshing(false)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-slate-700 space-y-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
              placeholder="Konum ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-slate-800 border border-slate-600 text-slate-400 hover:text-slate-100 transition-colors"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(['24h', '7d', '30d', 'all'] as TimeFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                timeFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {f === 'all' ? 'Hepsi' : f === '24h' ? '24 Saat' : f === '7d' ? '7 Gün' : '30 Gün'}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-700" />
          <button
            onClick={() => setSourceFilter(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !sourceFilter ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
            }`}
          >
            Tümü
          </button>
          {sources.map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                sourceFilter === s ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500">{filtered.length} deprem (min M{settings.minMagnitude})</p>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-800">
        {filtered.map(q => (
          <div
            key={q.id}
            onClick={() => selectEvent(q)}
            className="flex items-center gap-4 px-4 py-3 hover:bg-slate-800 cursor-pointer transition-colors group"
          >
            <div className={`w-12 h-12 rounded-xl ${getMagColor(q.magnitude)} flex items-center justify-center shrink-0`}>
              <span className="text-white font-bold text-lg leading-none">{q.magnitude.toFixed(1)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-200 truncate">{q.place || 'Konum bilinmiyor'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">{timeAgo(q.timestamp)}</span>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-500">{Math.abs(q.depth_km).toFixed(0)} km derinlik</span>
                <span className="text-slate-700">·</span>
                <span className="text-xs bg-slate-700 text-slate-300 px-1.5 rounded">{q.source}</span>
              </div>
            </div>
            {q.url && (
              <a
                href={q.url}
                onClick={e => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded text-slate-400 hover:text-slate-100"
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Deprem bulunamadı
          </div>
        )}
      </div>
    </div>
  )
}

export default QuakeListScreen
