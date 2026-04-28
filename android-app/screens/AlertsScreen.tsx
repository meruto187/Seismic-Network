import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, Switch, Divider, useTheme, Badge } from 'react-native-paper';
import { useSeismic } from '../context/SeismicContext';

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
};

const AlertsScreen = () => {
  const theme = useTheme();
  const {
    isConnected, isMonitoring, isCharging, toggleMonitoring,
    alerts, networkStatus, sensorData, settings,
  } = useSeismic();

  const statusColor = !isMonitoring ? '#9ca3af' : isConnected ? '#22c55e' : '#ef4444';
  const statusText = !isMonitoring ? 'Hazır' : isConnected ? 'Canlı İzleme Aktif' : 'Bağlanıyor...';

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.heroCard} mode="elevated">
        <Card.Content>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text variant="labelSmall" style={{ color: theme.colors.primary }}>MERKEZİ SİSMİK AĞ</Text>
              <Text variant="headlineSmall" style={{ fontWeight: 'bold', marginTop: 2 }}>Canlı İzleme</Text>
            </View>
            <View style={[styles.statusBadge, { borderColor: statusColor }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text variant="labelSmall" style={{ color: statusColor }}>{statusText}</Text>
            </View>
          </View>

          <View style={styles.toggleRow}>
            <View>
              <Text variant="bodyMedium">Sensör İzlemeyi Başlat</Text>
              <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2 }}>
                {settings.autoStartOnCharging
                  ? isCharging ? '⚡ Şarjda — otomatik aktif' : '🔋 Şarj edilince otomatik başlar'
                  : 'Otomatik başlatma kapalı'}
              </Text>
            </View>
            <Switch value={isMonitoring} onValueChange={toggleMonitoring} color={theme.colors.primary} />
          </View>

          {isMonitoring && (
            <View style={styles.sensorRow}>
              <SensorChip label="X" value={sensorData.x.toFixed(3)} />
              <SensorChip label="Y" value={sensorData.y.toFixed(3)} />
              <SensorChip label="Z" value={sensorData.z.toFixed(3)} />
              <SensorChip label="Büyüklük" value={sensorData.magnitude.toFixed(3)} highlight />
            </View>
          )}
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 8 }}>Ağ Durumu</Text>
          <View style={styles.statsRow}>
            <StatBox label="Aktif Cihaz" value={networkStatus.active_devices.toString()} />
            <StatBox label="WebSocket" value={networkStatus.websocket_connections.toString()} />
            <StatBox label="Global Olay" value={networkStatus.global_events.toString()} />
          </View>
        </Card.Content>
      </Card>

      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <View style={styles.alertHeader}>
            <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>Uyarılar</Text>
            {alerts.length > 0 && <Badge>{alerts.length}</Badge>}
          </View>
          {alerts.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
                Yakın zamanda uyarı alınmadı
              </Text>
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 4 }}>
                İzleme aktifken sarsıntı tespit edilirse burada görünür
              </Text>
            </View>
          ) : (
            alerts.map((alert, i) => (
              <View key={i}>
                <View style={[styles.alertItem, { borderLeftColor: PRIORITY_COLOR[alert.priority] || '#9ca3af' }]}>
                  <View style={styles.alertItemHeader}>
                    <Text variant="labelMedium" style={{ fontWeight: 'bold', color: PRIORITY_COLOR[alert.priority] || '#9ca3af' }}>
                      {alert.alert_type}
                    </Text>
                    <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                      {new Date(alert.timestamp).toLocaleTimeString('tr-TR')}
                    </Text>
                  </View>
                  <Text variant="bodySmall">{alert.message}</Text>
                </View>
                {i < alerts.length - 1 && <Divider />}
              </View>
            ))
          )}
        </Card.Content>
      </Card>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
};

const SensorChip = ({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) => {
  const theme = useTheme();
  return (
    <View style={[styles.sensorChip, highlight && { backgroundColor: theme.colors.primaryContainer }]}>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
      <Text variant="labelMedium" style={{ fontWeight: 'bold' }}>{value}</Text>
    </View>
  );
};

const StatBox = ({ label, value }: { label: string; value: string }) => {
  const theme = useTheme();
  return (
    <View style={[styles.statBox, { backgroundColor: theme.colors.surfaceVariant }]}>
      <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.primary }}>{value}</Text>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  heroCard: { marginBottom: 12 },
  card: { marginBottom: 12 },
  heroRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, gap: 6 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  sensorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  sensorChip: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1e293b' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 10 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  emptyBox: { paddingVertical: 24, alignItems: 'center' },
  alertItem: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 8 },
  alertItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
});

export default AlertsScreen;
