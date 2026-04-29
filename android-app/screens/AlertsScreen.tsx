import React, { useRef, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Animated, TouchableOpacity, useWindowDimensions } from 'react-native';
import { Text, Divider, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polyline, Line, Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSeismic } from '../context/SeismicContext';

const PRIORITY_COLOR: Record<string, string> = {
  CRITICAL: '#ef4444',
  HIGH: '#f97316',
  MEDIUM: '#eab308',
  LOW: '#3b82f6',
};

const getMagLevel = (mag: number) => {
  if (mag > 1.5) return { color: '#ef4444', label: 'YÜKSEK' };
  if (mag > 0.8) return { color: '#f97316', label: 'ORTA' };
  if (mag > 0.3) return { color: '#eab308', label: 'DÜŞÜK' };
  return { color: '#22c55e', label: 'SAKİN' };
};

const SeismographChart = ({ history, color }: { history: number[]; color: string }) => {
  const { width } = useWindowDimensions();
  const W = width - 48;
  const H = 56;
  const PAD = 4;
  const max = Math.max(...history, 0.5);
  const points = history.map((v, i) => {
    const x = PAD + (i / (history.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v / max) * (H - PAD * 2));
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const midY = (H / 2).toFixed(1);

  return (
    <View style={{ height: H, marginVertical: 4 }}>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.15" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill="transparent" />
        <Line x1={PAD} y1={midY} x2={W - PAD} y2={midY} stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
};

const AlertsScreen = () => {
  const theme = useTheme();
  const {
    isConnected, isMonitoring, isCharging, toggleMonitoring,
    alerts, networkStatus, sensorData, sensorHistory, settings,
  } = useSeismic();

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isMonitoring || !isConnected) {
      pulseAnim.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isMonitoring, isConnected]);

  const mag = sensorData.magnitude;
  const magLevel = getMagLevel(mag);
  const isActive = isMonitoring && isConnected;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.monitorCard, { backgroundColor: '#0f172a' }]}>
        <View style={styles.monitorHeader}>
          <View>
            <Text style={styles.monitorLabel}>MERKEZİ SİSMİK AĞ</Text>
            <Text style={styles.monitorTitle}>Sismik İzleme</Text>
          </View>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <View style={[styles.statusPill, { borderColor: isActive ? '#22c55e' : '#475569' }]}>
              <View style={[styles.statusDot, { backgroundColor: isActive ? '#22c55e' : '#475569' }]} />
              <Text style={[styles.statusText, { color: isActive ? '#22c55e' : '#94a3b8' }]}>
                {!isMonitoring ? 'Beklemede' : isConnected ? 'Canlı' : 'Bağlanıyor'}
              </Text>
            </View>
          </Animated.View>
        </View>

        {isMonitoring ? (
          <>
            <SeismographChart history={sensorHistory} color={magLevel.color} />
            <View style={styles.magRow}>
              <View>
                <Text style={styles.magValue}>{mag.toFixed(3)}</Text>
                <Text style={styles.magUnit}>ivme (g)</Text>
              </View>
              <View style={[styles.magBadge, { backgroundColor: magLevel.color + '22', borderColor: magLevel.color + '55' }]}>
                <Text style={[styles.magBadgeText, { color: magLevel.color }]}>{magLevel.label}</Text>
              </View>
            </View>
            <View style={styles.axisRow}>
              <AxisItem label="X" value={sensorData.x} />
              <View style={styles.axisDivider} />
              <AxisItem label="Y" value={sensorData.y} />
              <View style={styles.axisDivider} />
              <AxisItem label="Z" value={sensorData.z} />
            </View>
          </>
        ) : (
          <View style={styles.idleState}>
            <Ionicons name="radio-outline" size={32} color="#475569" />
            <Text style={styles.idleText}>İzleme kapalı</Text>
            <Text style={styles.idleSubtext}>
              {settings.autoStartOnCharging
                ? isCharging ? 'Şarjda — otomatik açılacak' : 'Şarja takınca otomatik başlar'
                : 'Başlatmak için dokunun'}
            </Text>
          </View>
        )}

        <TouchableOpacity
          onPress={toggleMonitoring}
          activeOpacity={0.8}
          style={[
            styles.toggleButton,
            { backgroundColor: isMonitoring ? '#ef444422' : '#3b82f622' },
          ]}
        >
          <Ionicons
            name={isMonitoring ? 'stop-circle' : 'play-circle'}
            size={18}
            color={isMonitoring ? '#ef4444' : '#3b82f6'}
          />
          <Text style={[styles.toggleText, { color: isMonitoring ? '#ef4444' : '#3b82f6' }]}>
            {isMonitoring ? 'İzlemeyi Durdur' : 'İzlemeyi Başlat'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.statsStrip, { backgroundColor: theme.colors.surface }]}>
        <StatItem label="Cihaz" value={networkStatus.active_devices} icon="hardware-chip-outline" />
        <View style={[styles.stripDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <StatItem label="Bağlantı" value={networkStatus.websocket_connections} icon="wifi-outline" />
        <View style={[styles.stripDivider, { backgroundColor: theme.colors.outlineVariant }]} />
        <StatItem label="Olay" value={networkStatus.global_events} icon="earth-outline" />
      </View>

      <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.sectionHeader}>
          <Text variant="titleSmall" style={{ fontWeight: '700' }}>Uyarılar</Text>
          {alerts.length > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countBadgeText}>{alerts.length}</Text>
            </View>
          )}
        </View>
        {alerts.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle-outline" size={28} color="#22c55e" style={{ marginBottom: 8 }} />
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center' }}>
              Aktif uyarı yok
            </Text>
          </View>
        ) : (
          alerts.slice(0, 20).map((alert, i) => (
            <View key={i}>
              <View style={[styles.alertItem, { borderLeftColor: PRIORITY_COLOR[alert.priority] || '#9ca3af' }]}>
                <View style={styles.alertItemHeader}>
                  <Text style={[styles.alertType, { color: PRIORITY_COLOR[alert.priority] || '#9ca3af' }]}>
                    {alert.alert_type}
                  </Text>
                  <Text style={[styles.alertTime, { color: theme.colors.onSurfaceVariant }]}>
                    {new Date(alert.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>{alert.message}</Text>
              </View>
              {i < Math.min(alerts.length, 20) - 1 && <Divider />}
            </View>
          ))
        )}
      </View>

      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const AxisItem = ({ label, value }: { label: string; value: number }) => (
  <View style={styles.axisItem}>
    <Text style={styles.axisLabel}>{label}</Text>
    <Text style={styles.axisValue}>{value >= 0 ? '+' : ''}{value.toFixed(3)}</Text>
  </View>
);

const StatItem = ({ label, value, icon }: { label: string; value: number; icon: string }) => {
  const theme = useTheme();
  return (
    <View style={styles.statItem}>
      <Ionicons name={icon as any} size={16} color={theme.colors.primary} />
      <Text variant="headlineSmall" style={{ fontWeight: '800', color: theme.colors.onSurface }}>{value}</Text>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  monitorCard: { margin: 12, borderRadius: 16, padding: 16, gap: 12 },
  monitorHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  monitorLabel: { fontSize: 10, fontWeight: '700', color: '#ef4444', letterSpacing: 1.5, marginBottom: 2 },
  monitorTitle: { fontSize: 20, fontWeight: '800', color: '#f1f5f9' },

  statusPill: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },

  magRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  magValue: { fontSize: 32, fontWeight: '800', color: '#f1f5f9', fontVariant: ['tabular-nums'] as any },
  magUnit: { fontSize: 11, color: '#64748b', marginTop: -4 },
  magBadge: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  magBadgeText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },

  axisRow: { flexDirection: 'row', backgroundColor: '#1e293b', borderRadius: 10, overflow: 'hidden' },
  axisItem: { flex: 1, alignItems: 'center', paddingVertical: 8 },
  axisLabel: { fontSize: 10, fontWeight: '700', color: '#64748b', marginBottom: 2 },
  axisValue: { fontSize: 13, fontWeight: '600', color: '#94a3b8', fontVariant: ['tabular-nums'] as any },
  axisDivider: { width: 1, backgroundColor: '#0f172a' },

  idleState: { alignItems: 'center', paddingVertical: 20, gap: 6 },
  idleText: { fontSize: 16, fontWeight: '600', color: '#475569' },
  idleSubtext: { fontSize: 12, color: '#334155', textAlign: 'center' },

  toggleButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 10, gap: 8 },
  toggleText: { fontSize: 14, fontWeight: '700' },

  statsStrip: { flexDirection: 'row', marginHorizontal: 12, borderRadius: 14, padding: 14, marginBottom: 12, elevation: 1 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  stripDivider: { width: 1 },

  section: { marginHorizontal: 12, borderRadius: 14, overflow: 'hidden', elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, paddingBottom: 10 },
  countBadge: { backgroundColor: '#ef4444', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  countBadgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  emptyBox: { paddingVertical: 28, alignItems: 'center' },
  alertItem: { borderLeftWidth: 3, paddingLeft: 12, paddingRight: 14, paddingVertical: 10, marginLeft: 2 },
  alertItemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  alertType: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  alertTime: { fontSize: 11 },
});

export default AlertsScreen;
