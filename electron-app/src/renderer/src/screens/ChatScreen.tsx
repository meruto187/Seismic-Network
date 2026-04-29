import React, { useState, useRef, useEffect } from 'react'
import { useSeismic, DEVICE_ID } from '../context/SeismicContext'
import { Send, Wifi, WifiOff } from 'lucide-react'

const ChatScreen: React.FC = () => {
  const { chatMessages, sendChatMessage, isConnected } = useSeismic()
  const [text, setText] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const handleSend = () => {
    if (!text.trim()) return
    sendChatMessage(text.trim())
    setText('')
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="h-full flex flex-col" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {isConnected
          ? <Wifi size={14} className="text-green-400" />
          : <WifiOff size={14} className="text-red-400 animate-pulse" />}
        <span className="text-sm" style={{ color: 'var(--text-2)' }}>
          {isConnected ? 'Ağa bağlı — sohbet aktif' : 'Bağlantı bekleniyor...'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-3)' }}>
            Henüz mesaj yok. İlk mesajı sen gönder!
          </div>
        )}
        {chatMessages.map(msg => {
          const isMe = msg.device_id === DEVICE_ID
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && (
                <span className="text-xs mb-1 ml-1" style={{ color: 'var(--text-3)' }}>{msg.device_id.slice(0, 14)}</span>
              )}
              <div
                className="max-w-md px-4 py-2 rounded-2xl text-sm"
                style={isMe
                  ? { background: '#3b82f6', color: '#fff', borderBottomRightRadius: 4 }
                  : { background: 'var(--surface-2)', color: 'var(--text)', borderBottomLeftRadius: 4 }}
              >
                {msg.text}
              </div>
              <span className="text-xs mt-1 mx-1" style={{ color: 'var(--text-3)' }}>
                {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 flex items-center gap-2 border-t" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <input
          className="flex-1 rounded-xl px-4 py-2.5 text-sm focus:outline-none"
          style={{ background: 'var(--surface-2)', border: '1px solid var(--border-2)', color: 'var(--text)' }}
          placeholder="Mesaj yaz... (Enter ile gönder)"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          maxLength={300}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-2.5 rounded-xl text-white disabled:opacity-40 transition-colors"
          style={{ background: '#3b82f6' }}
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

export default ChatScreen
