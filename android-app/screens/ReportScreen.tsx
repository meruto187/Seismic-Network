import React, { useState } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { Text, Card, Button, useTheme, Snackbar } from 'react-native-paper';
import { useSeismic } from '../context/SeismicContext';

const MMI_LEVELS = [
  { value: 2, label: 'II – Neredeyse fark edilmez', color: '#22c55e', desc: 'Yalnızca çok hassas kişilerce hissedilir' },
  { value: 3, label: 'III – Hafif titreşim', color: '#84cc16', desc: 'Asılı nesneler sallanır, geçen kamyon hissi' },
  { value: 4, label: 'IV – Gözle görülür titreşim', color: '#eab308', desc: 'Pencereler ve kapılar sallanır, çanaklar şakırdar' },
  { value: 5, label: 'V – Güçlü', color: '#f97316', desc: 'Raflardaki nesneler düşer, hafif hasar olabilir' },
  { value: 6, label: 'VI – Çok güçlü', color: '#ef4444', desc: 'Binalarda küçük çatlaklar, ağır mobilyalar hareket eder' },
  { value: 7, label: 'VII – Hasar verici', color: '#dc2626', desc: 'Zayıf yapılarda hasar, orta yapılarda kısmi çöküş' },
];

const ReportScreen = () => {
  const theme = useTheme();
  const { submitReport, userLocation, regionId } = useSeismic();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [snack, setSnack] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (selected === null) return;
    setSubmitting(true);
    const ok = await submitReport(selected);
    setSubmitting(false);
    setSnack(ok ? 'Rapor gönderildi, teşekkürler!' : 'Gönderilemedi, tekrar dene');
    if (ok) setSelected(null);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Card style={styles.card} mode="elevated">
        <Card.Content>
          <Text variant="headlineSmall" style={{ fontWeight: 'bold', textAlign: 'center', marginBottom: 4 }}>
            Sarsıntı Hissettim!
          </Text>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginBottom: 16 }}>
            Hissettiğin şiddet seviyesini seç ve ağa rapor gönder
          </Text>

          {userLocation ? (
            <Text variant="labelSmall" style={{ color: theme.colors.primary, textAlign: 'center', marginBottom: 12 }}>
              📍 {regionId.replace(/_/g, ' ')} · {userLocation.lat.toFixed(3)}, {userLocation.lon.toFixed(3)}
            </Text>
          ) : (
            <Text variant="labelSmall" style={{ color: theme.colors.error, textAlign: 'center', marginBottom: 12 }}>
              Konum alınamadı — rapor konumsuz gönderilecek
            </Text>
          )}

          {MMI_LEVELS.map(level => (
            <Button
              key={level.value}
              mode={selected === level.value ? 'contained' : 'outlined'}
              onPress={() => setSelected(level.value)}
              style={[styles.mmiButton, selected === level.value && { backgroundColor: level.color }]}
              contentStyle={{ flexDirection: 'column', height: 64 }}
              labelStyle={{ fontSize: 13, flexShrink: 1 }}
            >
              {level.label}
            </Button>
          ))}

          {selected !== null && (
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 8 }}>
              {MMI_LEVELS.find(l => l.value === selected)?.desc}
            </Text>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit}
            disabled={selected === null || submitting}
            loading={submitting}
            style={styles.submitButton}
            icon="send"
          >
            Rapor Gönder
          </Button>
        </Card.Content>
      </Card>

      <Snackbar
        visible={!!snack}
        onDismiss={() => setSnack(null)}
        duration={3000}
      >
        {snack}
      </Snackbar>

      <View style={{ height: 16 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  card: { marginBottom: 12 },
  mmiButton: { marginBottom: 8, borderRadius: 10 },
  submitButton: { marginTop: 16, borderRadius: 10 },
});

export default ReportScreen;
