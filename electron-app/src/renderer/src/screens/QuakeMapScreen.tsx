import React, { useEffect, useRef } from 'react'
import { useSeismic, GlobalEvent } from '../context/SeismicContext'

declare global {
  interface Window {
    L: typeof import('leaflet')
  }
}

const getMagColor = (mag: number) => {
  if (mag >= 6.0) return '#ef4444'
  if (mag >= 4.0) return '#f97316'
  if (mag >= 2.0) return '#eab308'
  return '#22c55e'
}

const getMagRadius = (mag: number) => {
  if (mag >= 6.0) return 18
  if (mag >= 5.0) return 14
  if (mag >= 4.0) return 10
  if (mag >= 3.0) return 7
  return 5
}

const timeAgo = (ts: string) => {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins} dk önce`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} sa önce`
  return `${Math.floor(hrs / 24)} gün önce`
}

const QuakeMapScreen: React.FC = () => {
  const { globalEvents, selectedEvent, selectEvent, settings } = useSeismic()
  const mapRef = useRef<any>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<any[]>([])

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const L = window.L
    if (!L) return

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(map)

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const L = window.L
    if (!map || !L) return

    markersRef.current.forEach(m => m.remove())
    markersRef.current = []

    const filtered = globalEvents.filter(e => e.magnitude >= settings.minMagnitude)

    filtered.forEach(event => {
      const color = getMagColor(event.magnitude)
      const radius = getMagRadius(event.magnitude)

      const marker = L.circleMarker([event.latitude, event.longitude], {
        radius,
        fillColor: color,
        color: '#fff',
        weight: 1,
        opacity: 0.9,
        fillOpacity: 0.75,
      })

      const popupContent = `
        <div style="font-family:sans-serif;min-width:200px">
          <div style="font-size:20px;font-weight:bold;color:${color}">M${event.magnitude.toFixed(1)}</div>
          <div style="font-size:13px;font-weight:600;margin-top:4px">${event.place || 'Konum bilinmiyor'}</div>
          <div style="font-size:11px;color:#94a3b8;margin-top:4px">${timeAgo(event.timestamp)}</div>
          <div style="font-size:11px;color:#94a3b8">${Math.abs(event.depth_km).toFixed(0)} km derinlik · ${event.source}</div>
          ${event.url ? `<a href="${event.url}" target="_blank" style="font-size:11px;color:#60a5fa;display:block;margin-top:6px">Detaylar →</a>` : ''}
        </div>
      `

      marker.bindPopup(popupContent, { maxWidth: 260 })
      marker.on('click', () => selectEvent(event))
      marker.addTo(map)
      markersRef.current.push(marker)
    })
  }, [globalEvents, settings.minMagnitude])

  useEffect(() => {
    if (!selectedEvent || !mapRef.current) return
    mapRef.current.flyTo([selectedEvent.latitude, selectedEvent.longitude], 6, { duration: 1.2 })
    const marker = markersRef.current.find((_, i) => {
      const ev = globalEvents.filter(e => e.magnitude >= settings.minMagnitude)[i]
      return ev?.id === selectedEvent.id
    })
    if (marker) marker.openPopup()
  }, [selectedEvent])

  return (
    <div className="h-full flex flex-col">
      <div ref={mapContainerRef} className="flex-1" />
      <div className="flex items-center gap-4 px-4 py-2 bg-slate-900 border-t border-slate-700 text-xs text-slate-400">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-green-500 inline-block" />M2-3</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-500 inline-block" />M3-4</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />M4-5</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />M6+</div>
        <span className="ml-auto">{globalEvents.filter(e => e.magnitude >= settings.minMagnitude).length} nokta</span>
      </div>
    </div>
  )
}

export default QuakeMapScreen
