import React, { useState, useRef } from 'react';
import { View, ScrollView, StyleSheet, FlatList, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Card, Switch, Divider, useTheme, TextInput, IconButton, Chip } from 'react-native-paper';
import { useSeismic, DEVICE_ID } from '../context/SeismicContext';

const SettingsScreen = () => {
  const theme = useTheme();
  const { settings, updateSettings, chatMessages, sendChatMessage, isConnected } = useSeismic();
  const [chatText, setChatText] = useState('');
  const [activeTab, setActiveTab] = useState<'settings' | 'chat'>('settings');
  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!chatText.trim()) return;
    sendChatMessage(chatText.trim());
    setChatText('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[styles.tabRow, { backgroundColor: theme.colors.surface }]}>
        <Chip
          selected={activeTab === 'settings'}
          onPress={() => setActiveTab('settings')}
          style={styles.tabChip}
        >
          Ayarlar
        </Chip>
        <Chip
          selected={activeTab === 'chat'}
          onPress={() => setActiveTab('chat')}
          style={styles.tabChip}
        >
          Sohbet
        </Chip>
      </View>

      {activeTab === 'settings' ? (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <Card style={styles.card} mode="elevated">
            <Card.Content>
              <Text variant="titleMedium" style={{ fontWeight: 'bold', marginBottom: 12 }}>Alarm Özelleştirme</Text>

              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>
                Minimum Büyüklük Eşiği
              </Text>
              <View style={styles.magRow}>
                {[1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0].map(mag => (
                  <Chip
                    key={mag}
                    selected={settings.minMagnitude === mag}
                    onPress={() => updateSettings({ minMagnitude: mag })}
                    compact
                    style={styles.magChip}
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
                <Switch
                  value={settings.notifySound}
                  onValueChange={v => updateSettings({ notifySound: v })}
                  color={theme.colors.primary}
                />
              </View>

              <Divider style={{ marginVertical: 8 }} />

              <View style={styles.switchRow}>
                <View style={{ flex: 1 }}>
                  <Text variant="bodyMedium">Titreşim</Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>Deprem uyarısında titreşim</Text>
                </View>
                <Switch
                  value={settings.notifyVibration}
                  onValueChange={v => updateSettings({ notifyVibration: v })}
                  color={theme.colors.primary}
                />
              </View>

              <Divider style={{ marginVertical: 12 }} />

              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 4 }}>
                Maksimum Mesafe Filtresi
              </Text>
              <View style={styles.magRow}>
                {[100, 250, 500, 1000, 9999].map(km => (
                  <Chip
                    key={km}
                    selected={settings.maxDistanceKm === km}
                    onPress={() => updateSettings({ maxDistanceKm: km })}
                    compact
                    style={styles.magChip}
                  >
                    {km === 9999 ? 'Tümü' : `${km} km`}
                  </Chip>
                ))}
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

          <View style={{ height: 16 }} />
        </ScrollView>
      ) : (
        <View style={[styles.chatContainer, { backgroundColor: theme.colors.background }]}>
          {!isConnected && (
            <View style={[styles.chatOffline, { backgroundColor: theme.colors.errorContainer }]}>
              <Text variant="labelSmall" style={{ color: theme.colors.error }}>
                Sohbet için izleme modunu aktif et
              </Text>
            </View>
          )}

          <FlatList
            ref={flatListRef}
            data={chatMessages}
            keyExtractor={item => item.id}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            contentContainerStyle={{ padding: 12, paddingBottom: 4 }}
            ListEmptyComponent={
              <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, textAlign: 'center', marginTop: 40 }}>
                Henüz mesaj yok
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[
                styles.chatBubble,
                item.device_id === DEVICE_ID
                  ? [styles.chatBubbleMine, { backgroundColor: theme.colors.primaryContainer }]
                  : [styles.chatBubbleOther, { backgroundColor: theme.colors.surfaceVariant }]
              ]}>
                {item.device_id !== DEVICE_ID && (
                  <Text variant="labelSmall" style={{ color: theme.colors.primary, marginBottom: 2 }}>
                    {item.device_id.substring(0, 12)}
                  </Text>
                )}
                <Text variant="bodyMedium">{item.text}</Text>
                <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 2, textAlign: 'right' }}>
                  {new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )}
          />

          <View style={[styles.chatInput, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outlineVariant }]}>
            <TextInput
              value={chatText}
              onChangeText={setChatText}
              placeholder="Mesaj yaz..."
              mode="outlined"
              dense
              style={{ flex: 1 }}
              maxLength={300}
              onSubmitEditing={handleSend}
              right={<TextInput.Icon icon="send" onPress={handleSend} disabled={!chatText.trim() || !isConnected} />}
            />
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  tabRow: { flexDirection: 'row', padding: 8, gap: 8, elevation: 2 },
  tabChip: { flex: 1 },
  card: { marginBottom: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  magRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  magChip: {},
  chatContainer: { flex: 1 },
  chatOffline: { padding: 8, alignItems: 'center' },
  chatBubble: { marginBottom: 8, borderRadius: 12, padding: 10, maxWidth: '80%' },
  chatBubbleMine: { alignSelf: 'flex-end', borderBottomRightRadius: 2 },
  chatBubbleOther: { alignSelf: 'flex-start', borderBottomLeftRadius: 2 },
  chatInput: { flexDirection: 'row', padding: 8, borderTopWidth: 1, alignItems: 'center' },
});

export default SettingsScreen;
