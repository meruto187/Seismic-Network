import React from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Modal, Portal, Text, Button, Card, useTheme, Divider, IconButton } from 'react-native-paper';
import { GlobalEvent } from '../context/SeismicContext';

interface Props {
  visible: boolean;
  event: GlobalEvent | null;
  onDismiss: () => void;
  userLat?: number;
  userLon?: number;
}

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

const getIntensityDescription = (mag: number) => {
  if (mag >= 8.0) return { label: 'Yıkıcı', desc: 'Şiddetli hasar, binalarda çökme' };
  if (mag >= 7.0) return { label: 'Şiddetli', desc: 'Ciddi hasar, geniş alan etkilenir' };
  if (mag >= 6.0) return { label: 'Güçlü', desc: 'Orta hasar, yapısal zarar' };
  if (mag >= 5.0) return { label: 'Orta', desc: 'Hafif hasar, eşyalar düşer' };
  if (mag >= 4.0) return { label: 'Hafif', desc: 'Hissedilir, iç mekanlarda rahatsızlık' };
  if (mag >= 3.0) return { label: 'Çok Hafif', desc: 'Az hissedilir' };
  return { label: 'Minimal', desc: 'Genellikle fark edilmez' };
};

const QuakeDetailModal: React.FC<Props> = ({ visible, event, onDismiss, userLat, userLon }) => {
  const theme = useTheme();
  
  if (!event) return null;

  const magColor = getMagnitudeColor(event.magnitude);
  const intensity = getIntensityDescription(event.magnitude);
  const distance = userLat != null && userLon != null
    ? getDistanceKm(userLat, userLon, event.latitude, event.longitude)
    : null;

  const formattedDate = new Date(event.timestamp).toLocaleString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const timeAgo = () => {
    const diff = Date.now() - new Date(event.timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins} dakika önce`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} saat önce`;
    const days = Math.floor(hrs / 24);
    return `${days} gün önce`;
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={[styles.modal, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.header}>
          <View style={[styles.magBadge, { backgroundColor: magColor }]}>
            <Text variant="displaySmall" style={{ color: '#fff', fontWeight: 'bold' }}>
              {event.magnitude.toFixed(1)}
            </Text>
            <Text variant="labelSmall" style={{ color: '#fff', opacity: 0.9 }}>
              {event.magnitude_type?.toUpperCase() || 'M'}
            </Text>
          </View>
          <IconButton icon="close" size={24} onPress={onDismiss} style={styles.closeBtn} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginBottom: 4 }}>
            {event.place || 'Konum bilinmiyor'}
          </Text>
          
          <View style={styles.chipRow}>
            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>
              {formattedDate}
            </Text>
          </View>

          <Card style={[styles.intensityCard, { borderLeftColor: magColor }]} mode="outlined">
            <Card.Content>
              <Text variant="titleMedium" style={{ color: magColor, fontWeight: 'bold' }}>
                {intensity.label} Şiddet
              </Text>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                {intensity.desc}
              </Text>
            </Card.Content>
          </Card>

          <Divider style={styles.divider} />

          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={styles.detailLabel}>Derinlik</Text>
            <Text variant="bodyLarge">{Math.abs(event.depth_km).toFixed(1)} km</Text>
          </View>

          {distance !== null && (
            <View style={styles.detailRow}>
              <Text variant="labelLarge" style={styles.detailLabel}>Uzaklık</Text>
              <Text variant="bodyLarge" style={{ color: theme.colors.primary }}>
                {distance} km
              </Text>
            </View>
          )}

          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={styles.detailLabel}>Kaynak</Text>
            <Text variant="bodyLarge">{event.source}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={styles.detailLabel}>Geçen Süre</Text>
            <Text variant="bodyLarge">{timeAgo()}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text variant="labelLarge" style={styles.detailLabel}>Koordinatlar</Text>
            <Text variant="bodyMedium" style={{ fontFamily: 'monospace' }}>
              {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
            </Text>
          </View>

          <Divider style={styles.divider} />

          {event.url && (
            <Button 
              mode="contained" 
              onPress={() => Linking.openURL(event.url!)}
              style={styles.actionBtn}
              icon="open-in-new"
            >
              Kaynak Detayları
            </Button>
          )}

          <Button 
            mode="outlined" 
            onPress={onDismiss}
            style={styles.actionBtn}
          >
            Kapat
          </Button>
        </ScrollView>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 20,
    borderRadius: 16,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 0,
  },
  magBadge: {
    width: 80,
    height: 80,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    margin: -8,
  },
  content: {
    padding: 16,
    paddingTop: 8,
  },
  chipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 8,
  },
  intensityCard: {
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  divider: {
    marginVertical: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  detailLabel: {
    color: '#64748b',
  },
  actionBtn: {
    marginTop: 12,
  },
});

export default QuakeDetailModal;
