import React, { useState, useMemo } from 'react'
import { useSeismic } from '../context/SeismicContext'
import { Search, RefreshCw, ExternalLink } from 'lucide-react'

type TimeFilter = '24h' | '7d' | '30d' | 'all'
type SortKey = 'time' | 'magnitude' | 'depth'

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
  const [sortKey, setSortKey] = useState<SortKey>('time')
  const [sortAsc, setSortAsc] = useState(false)

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
    const list = globalEvents
      .filter(e => e.magnitude >= settings.minMagnitude)
      .filter(e => !sourceFilter || e.source === sourceFilter)
      .filter(e => !search || (e.place || '').toLowerCase().includes(search.toLowerCase()))
      .filter(e => timeFilter === 'all' || new Date(e.timestamp).getTime() >= thr)
    const dir = sortAsc ? 1 : -1
    return list.sort((a, b) => {
      if (sortKey === 'magnitude') return dir * (a.magnitude - b.magnitude)
      if (sortKey === 'depth') return dir * (Math.abs(a.depth_km) - Math.abs(b.depth_km))
      return dir * (new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    })
  }, [globalEvents, search, timeFilter, sourceFilter, settings.minMagnitude, sortKey, sortAsc])

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshEvents()
    setRefreshing(false)
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="p-4 space-y-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }} />
            <input
              className="w-full rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none"
              style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
              placeholder="Konum ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={handleRefresh}
            className="p-2 rounded-lg border transition-colors"
            style={{ background: 'var(--surface-2)', borderColor: 'var(--border-2)', color: 'var(--text-2)' }}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {(['24h', '7d', '30d', 'all'] as TimeFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={timeFilter === f
                ? { background: '#3b82f6', color: '#fff' }
                : { background: 'var(--surface-2)', color: 'var(--text-2)' }}
            >
              {f === 'all' ? 'Hepsi' : f === '24h' ? '24 Saat' : f === '7d' ? '7 Gün' : '30 Gün'}
            </button>
          ))}
          <div className="w-px h-4" style={{ background: 'var(--border)' }} />
          <button
            onClick={() => setSourceFilter(null)}
            className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
            style={!sourceFilter
              ? { background: 'var(--surface-3)', color: 'var(--text)' }
              : { background: 'var(--surface-2)', color: 'var(--text-2)' }}
          >
            Tümü
          </button>
          {sources.map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(sourceFilter === s ? null : s)}
              className="px-3 py-1 rounded-full text-xs font-medium transition-colors"
              style={sourceFilter === s
                ? { background: 'var(--surface-3)', color: 'var(--text)' }
                : { background: 'var(--surface-2)', color: 'var(--text-2)' }}
            >
              {s}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>{filtered.length} deprem (min M{settings.minMagnitude})</p>
          <div className="flex items-center gap-1">
            {([['time','Zaman'],['magnitude','Büyüklük'],['depth','Derinlik']] as [SortKey,string][]).map(([k, lbl]) => (
              <button
                key={k}
                onClick={() => { sortKey === k ? setSortAsc(v => !v) : (setSortKey(k), setSortAsc(false)) }}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all"
                style={sortKey === k
                  ? { background: 'var(--surface-3)', color: 'var(--text)' }
                  : { color: 'var(--text-3)' }}
              >
                {lbl}
                {sortKey === k && <span className="text-[10px]">{sortAsc ? '↑' : '↓'}</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--bg)' }}>
        {filtered.map(q => (
          <div
            key={q.id}
            onClick={() => selectEvent(q)}
            className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors group border-b"
            style={{ borderColor: 'var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <div className={`w-12 h-12 rounded-xl ${getMagColor(q.magnitude)} flex items-center justify-center shrink-0`}>
              <span className="text-white font-bold text-lg leading-none">{q.magnitude.toFixed(1)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{q.place || 'Konum bilinmiyor'}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>{timeAgo(q.timestamp)}</span>
                <span style={{ color: 'var(--border-2)' }}>·</span>
                <span className="text-xs" style={{ color: 'var(--text-3)' }}>{Math.abs(q.depth_km).toFixed(0)} km</span>
                <span style={{ color: 'var(--border-2)' }}>·</span>
                <span className="text-xs px-1.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--text-2)' }}>{q.source}</span>
              </div>
            </div>
            {q.url && (
              <a
                href={q.url}
                onClick={e => e.stopPropagation()}
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded"
                style={{ color: 'var(--text-2)' }}
              >
                <ExternalLink size={14} />
              </a>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-3)' }}>
            Deprem bulunamadı
          </div>
        )}
      </div>
    </div>
  )
}

export default QuakeListScreen
