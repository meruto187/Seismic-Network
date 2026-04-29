import React, { useRef, useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text, useTheme, SegmentedButtons } from 'react-native-paper';
import WebView from 'react-native-webview';
import { useSeismic, GlobalEvent } from '../context/SeismicContext';

type MagFilter = 'all' | '2' | '4' | '6';

const buildLeafletHTML = (events: GlobalEvent[]) => {
  const geojson = {
    type: 'FeatureCollection',
    features: events.map(e => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [e.longitude, e.latitude] },
      properties: {
        id: e.id,
        magnitude: e.magnitude,
        place: e.place || 'Bilinmiyor',
        depth: Math.abs(e.depth_km).toFixed(0),
        source: e.source,
        timestamp: e.timestamp,
        url: e.url || '',
      },
    })),
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body, #map { width: 100%; height: 100%; background: #0b0f1a; }
  .leaflet-popup-content-wrapper {
    background: #1a2235; color: #f1f5f9; border: 1px solid #243044;
    border-radius: 10px; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
  }
  .leaflet-popup-tip { background: #1a2235; }
  .leaflet-popup-content { font-family: -apple-system, sans-serif; font-size: 13px; line-height: 1.5; }
  .mag { font-size: 22px; font-weight: 800; }
  .place { font-weight: 600; margin-top: 2px; }
  .meta { font-size: 11px; color: #94a3b8; margin-top: 4px; }
  a { color: #60a5fa; font-size: 11px; }
</style>
</head>
<body>
<div id="map"></div>
<script>
var map = L.map('map', { center: [20, 20], zoom: 2, zoomControl: true });
L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap', maxZoom: 18
}).addTo(map);

var data = ${JSON.stringify(geojson)};

function magColor(m) {
  if (m >= 6.0) return '#ef4444';
  if (m >= 4.0) return '#f97316';
  if (m >= 2.0) return '#eab308';
  return '#22c55e';
}

function magRadius(m) {
  if (m >= 6.0) return 18;
  if (m >= 5.0) return 13;
  if (m >= 4.0) return 9;
  if (m >= 3.0) return 6;
  return 4;
}

function timeAgo(ts) {
  var diff = Date.now() - new Date(ts).getTime();
  var m = Math.floor(diff / 60000);
  if (m < 60) return m + ' dk önce';
  var h = Math.floor(m / 60);
  if (h < 24) return h + ' sa önce';
  return Math.floor(h / 24) + ' gün önce';
}

data.features.forEach(function(f) {
  var p = f.properties;
  var c = magColor(p.magnitude);
  var marker = L.circleMarker(
    [f.geometry.coordinates[1], f.geometry.coordinates[0]],
    { radius: magRadius(p.magnitude), fillColor: c, color: '#fff', weight: 1, opacity: 0.9, fillOpacity: 0.75 }
  );
  var popup = '<div class="mag" style="color:' + c + '">M' + p.magnitude.toFixed(1) + '</div>'
    + '<div class="place">' + p.place + '</div>'
    + '<div class="meta">' + timeAgo(p.timestamp) + ' &middot; ' + p.depth + ' km &middot; ' + p.source + '</div>'
    + (p.url ? '<a href="' + p.url + '" target="_blank">Detaylar →</a>' : '');
  marker.bindPopup(popup, { maxWidth: 240 });
  marker.addTo(map);
});
</script>
</body>
</html>`;
};

const QuakeMapScreen = () => {
  const theme = useTheme();
  const { globalEvents, settings } = useSeismic();
  const [magFilter, setMagFilter] = useState<MagFilter>('all');
  const [loading, setLoading] = useState(true);

  const filtered = globalEvents.filter(e => {
    const minMag = magFilter === 'all' ? settings.minMagnitude : parseFloat(magFilter);
    return e.magnitude >= minMag;
  });

  const html = buildLeafletHTML(filtered);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.toolbar, { backgroundColor: theme.colors.surface }]}>
        <SegmentedButtons
          value={magFilter}
          onValueChange={v => setMagFilter(v as MagFilter)}
          density="small"
          style={styles.segmented}
          buttons={[
            { value: 'all', label: `M${settings.minMagnitude}+` },
            { value: '2', label: 'M2+' },
            { value: '4', label: 'M4+' },
            { value: '6', label: 'M6+' },
          ]}
        />
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4, textAlign: 'center' }}>
          {filtered.length} deprem noktası
        </Text>
      </View>

      <View style={styles.mapContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              Harita yükleniyor...
            </Text>
          </View>
        )}
        <WebView
          source={{ html }}
          style={styles.webView}
          onLoad={() => setLoading(false)}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          scrollEnabled={false}
          bounces={false}
        />
      </View>

      <View style={[styles.legend, { backgroundColor: theme.colors.surface }]}>
        {[
          { label: 'M2–3', color: '#22c55e' },
          { label: 'M3–4', color: '#eab308' },
          { label: 'M4–6', color: '#f97316' },
          { label: 'M6+', color: '#ef4444' },
        ].map(({ label, color }) => (
          <View key={label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: color }]} />
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: { paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  segmented: { width: '100%' },
  mapContainer: { flex: 1, position: 'relative' },
  webView: { flex: 1, backgroundColor: '#0b0f1a' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0b0f1a',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
});

export default QuakeMapScreen;
