import React from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Switch, Divider, useTheme, Chip } from 'react-native-paper';
import { useSeismic, DEVICE_ID } from '../context/SeismicContext';

const SettingsScreen = () => {
  const theme = useTheme();
  const { settings, updateSettings } = useSeismic();

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
});

export default SettingsScreen;
