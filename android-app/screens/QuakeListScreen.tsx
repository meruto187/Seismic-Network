import React, { useState, useMemo } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Text, Card, Chip, Searchbar, useTheme, ActivityIndicator } from 'react-native-paper';
import { useSeismic, GlobalEvent } from '../context/SeismicContext';

const getMagnitudeColor = (mag: number) => {
  if (mag >= 6.0) return '#ef4444';
  if (mag >= 4.0) return '#f97316';
  if (mag >= 2.0) return '#eab308';
  return '#22c55e';
};

const getDistanceKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

const QuakeCard = ({ event, userLat, userLon }: { event: GlobalEvent; userLat?: number; userLon?: number }) => {
  const theme = useTheme();
  const magColor = getMagnitudeColor(event.magnitude);
  const distance = userLat != null && userLon != null
    ? getDistanceKm(userLat, userLon, event.latitude, event.longitude)
    : null;
  const timeAgo = () => {
    const diff = Date.now() - new Date(event.timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} dk önce`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} sa önce`;
    return `${Math.floor(hrs / 24)} gün önce`;
  };

  return (
    <TouchableOpacity onPress={() => event.url && Linking.openURL(event.url)} activeOpacity={0.7}>
      <Card style={[styles.quakeCard, { borderLeftColor: magColor, borderLeftWidth: 4 }]} mode="elevated">
        <Card.Content style={styles.cardContent}>
          <View style={[styles.magBadge, { backgroundColor: magColor }]}>
            <Text variant="titleLarge" style={{ color: '#fff', fontWeight: 'bold' }}>
              {event.magnitude.toFixed(1)}
            </Text>
            <Text variant="labelSmall" style={{ color: '#fff', opacity: 0.85 }}>
              {event.magnitude_type?.toUpperCase() || 'M'}
            </Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text variant="bodyMedium" style={{ fontWeight: 'bold' }} numberOfLines={1}>
              {event.place || 'Konum bilinmiyor'}
            </Text>
            <View style={styles.metaRow}>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {new Date(event.timestamp).toLocaleString('tr-TR')} · {timeAgo()}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <Chip compact style={styles.chip} textStyle={{ fontSize: 10 }}>{event.source}</Chip>
              {event.depth_km != null && (
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginLeft: 6 }}>
                  {Math.abs(event.depth_km).toFixed(0)} km derinlik
                </Text>
              )}
              {distance != null && (
                <Text variant="labelSmall" style={{ color: theme.colors.primary, marginLeft: 6 }}>
                  {distance} km uzakta
                </Text>
              )}
            </View>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const QuakeListScreen = () => {
  const theme = useTheme();
  const { globalEvents, userLocation, settings } = useSeismic();
  const [search, setSearch] = useState('');
  const [filterSource, setFilterSource] = useState<string | null>(null);

  const sources = useMemo(() => [...new Set(globalEvents.map(e => e.source))], [globalEvents]);

  const filtered = useMemo(() => {
    return globalEvents
      .filter(e => e.magnitude >= settings.minMagnitude)
      .filter(e => !filterSource || e.source === filterSource)
      .filter(e => !search || (e.place || '').toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [globalEvents, search, filterSource, settings.minMagnitude]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Searchbar
        placeholder="Konum ara..."
        value={search}
        onChangeText={setSearch}
        style={styles.searchbar}
      />
      <View style={styles.filterRow}>
        <Chip
          selected={!filterSource}
          onPress={() => setFilterSource(null)}
          style={styles.filterChip}
          compact
        >
          Tümü
        </Chip>
        {sources.map(src => (
          <Chip
            key={src}
            selected={filterSource === src}
            onPress={() => setFilterSource(filterSource === src ? null : src)}
            style={styles.filterChip}
            compact
          >
            {src}
          </Chip>
        ))}
      </View>

      {globalEvents.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
          <Text variant="bodyMedium" style={{ marginTop: 8, color: theme.colors.onSurfaceVariant }}>
            Deprem verileri yükleniyor...
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <QuakeCard
              event={item}
              userLat={userLocation?.lat}
              userLon={userLocation?.lon}
            />
          )}
          contentContainerStyle={{ padding: 12, paddingTop: 4 }}
          ListHeaderComponent={
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 8 }}>
              {filtered.length} deprem gösteriliyor (min M{settings.minMagnitude})
            </Text>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchbar: { margin: 12, marginBottom: 4 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, paddingBottom: 8, gap: 6 },
  filterChip: { marginRight: 4 },
  quakeCard: { marginBottom: 8, borderRadius: 10 },
  cardContent: { flexDirection: 'row', alignItems: 'center' },
  magBadge: { width: 54, height: 54, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3, flexWrap: 'wrap' },
  chip: { height: 22 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

export default QuakeListScreen;
