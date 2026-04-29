import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Text, Card, Switch, Divider, useTheme, Chip, Button } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSeismic, DEVICE_ID } from '../context/SeismicContext';
import ReportScreen from './ReportScreen';

const SettingsScreen = () => {
  const theme = useTheme();
  const { settings, updateSettings } = useSeismic();
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12 }}>Alarm Özelleştirme</Text>

          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>
            Minimum Büyüklük Eşiği
          </Text>
          <View style={styles.chipRow}>
            {[1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0].map(mag => (
              <Chip
                key={mag}
                selected={settings.minMagnitude === mag}
                onPress={() => updateSettings({ minMagnitude: mag })}
                compact
              >
                M{mag}
              </Chip>
            ))}
          </View>

          <Divider style={{ marginVertical: 12 }} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">Bildirim Sesi</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Deprem uyarısında ses çal</Text>
            </View>
            <Switch value={settings.notifySound} onValueChange={v => updateSettings({ notifySound: v })} color={theme.colors.primary} />
          </View>

          <Divider style={{ marginVertical: 8 }} />

          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">Titreşim</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Deprem uyarısında titreşim</Text>
            </View>
            <Switch value={settings.notifyVibration} onValueChange={v => updateSettings({ notifyVibration: v })} color={theme.colors.primary} />
          </View>

          <Divider style={{ marginVertical: 12 }} />

          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>
            Maksimum Mesafe Filtresi
          </Text>
          <View style={styles.chipRow}>
            {[100, 250, 500, 1000, 9999].map(km => (
              <Chip
                key={km}
                selected={settings.maxDistanceKm === km}
                onPress={() => updateSettings({ maxDistanceKm: km })}
                compact
              >
                {km === 9999 ? 'Tümü' : `${km} km`}
              </Chip>
            ))}
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12 }}>İzleme Davranışı</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text variant="bodyMedium">Şarjda Otomatik Başlat</Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                Cihaz şarja takılınca sensör izlemeyi otomatik başlat
              </Text>
            </View>
            <Switch value={settings.autoStartOnCharging} onValueChange={v => updateSettings({ autoStartOnCharging: v })} color={theme.colors.primary} />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
        <Card.Content style={{ gap: 8 }}>
          <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Deprem Raporu</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            Hissettiklerin bir sarsıntıyı ağa raporla
          </Text>
          <Button
            mode="contained"
            icon="megaphone-outline"
            onPress={() => setReportOpen(true)}
            style={{ marginTop: 4 }}
          >
            Rapor Gönder
          </Button>
        </Card.Content>
      </Card>

      <Modal visible={reportOpen} animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
          <View style={[styles.modalHeader, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.outlineVariant }]}>
            <Text variant="titleMedium" style={{ fontWeight: '700' }}>Deprem Raporu</Text>
            <TouchableOpacity onPress={() => setReportOpen(false)}>
              <Ionicons name="close" size={24} color={theme.colors.onSurface} />
            </TouchableOpacity>
          </View>
          <ReportScreen />
        </View>
      </Modal>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>Cihaz Bilgisi</Text>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Cihaz ID</Text>
          <Text variant="bodyMedium" style={{ fontFamily: 'monospace', marginTop: 2 }}>{DEVICE_ID}</Text>
        </Card.Content>
      </Card>

      <View style={{ height: 24 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  card: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
});

export default SettingsScreen;
