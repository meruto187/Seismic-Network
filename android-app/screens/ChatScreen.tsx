import React, { useState, useRef } from 'react';
import { View, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput, IconButton, useTheme, Divider, Surface } from 'react-native-paper';
import { useSeismic, DEVICE_ID } from '../context/SeismicContext';

const ChatScreen = () => {
  const theme = useTheme();
  const { chatMessages, sendChatMessage, isConnected } = useSeismic();
  const [chatText, setChatText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!chatText.trim()) return;
    sendChatMessage(chatText.trim());
    setChatText('');
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={80}
    >
      <View style={[styles.statusBar, { backgroundColor: theme.colors.surface }]}>
        <View style={[styles.dot, { backgroundColor: isConnected ? '#22c55e' : '#9ca3af' }]} />
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {isConnected ? 'Ağa bağlı' : 'Bağlantı bekleniyor...'}
        </Text>
      </View>
      <Divider />

      {chatMessages.length === 0 ? (
        <View style={styles.empty}>
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            Henüz mesaj yok. İlk mesajı sen gönder!
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={chatMessages}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const isMe = item.device_id === DEVICE_ID;
            return (
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                {!isMe && (
                  <Text variant="labelSmall" style={styles.deviceId}>
                    {item.device_id.slice(0, 12)}
                  </Text>
                )}
                <Surface
                  style={[
                    styles.bubbleSurface,
                    { backgroundColor: isMe ? theme.colors.primary : theme.colors.surfaceVariant },
                  ]}
                  elevation={1}
                >
                  <Text
                    variant="bodyMedium"
                    style={{ color: isMe ? theme.colors.onPrimary : theme.colors.onSurfaceVariant }}
                  >
                    {item.text}
                  </Text>
                </Surface>
                <Text variant="labelSmall" style={styles.timestamp}>
                  {new Date(item.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            );
          }}
        />
      )}

      <Divider />
      <View style={[styles.inputRow, { backgroundColor: theme.colors.surface }]}>
        <TextInput
          style={styles.input}
          value={chatText}
          onChangeText={setChatText}
          placeholder="Mesaj yaz..."
          mode="outlined"
          dense
          onSubmitEditing={handleSend}
          returnKeyType="send"
          maxLength={300}
          right={
            <TextInput.Icon
              icon="send"
              disabled={!chatText.trim()}
              onPress={handleSend}
            />
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusBar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  list: { padding: 12, gap: 8 },
  bubble: { maxWidth: '80%', gap: 2 },
  bubbleMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubbleSurface: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  deviceId: { color: '#9ca3af', marginBottom: 2, marginLeft: 4 },
  timestamp: { color: '#9ca3af', marginTop: 2, marginRight: 4 },
  inputRow: { padding: 8 },
  input: { flex: 1 },
});

export default ChatScreen;
