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
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700 bg-slate-900">
        {isConnected
          ? <Wifi size={14} className="text-green-400" />
          : <WifiOff size={14} className="text-red-400 animate-pulse" />}
        <span className="text-sm text-slate-400">
          {isConnected ? 'Ağa bağlı — sohbet aktif' : 'Bağlantı bekleniyor...'}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMessages.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            Henüz mesaj yok. İlk mesajı sen gönder!
          </div>
        )}
        {chatMessages.map(msg => {
          const isMe = msg.device_id === DEVICE_ID
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
              {!isMe && (
                <span className="text-xs text-slate-500 mb-1 ml-1">{msg.device_id.slice(0, 14)}</span>
              )}
              <div className={`max-w-md px-4 py-2 rounded-2xl text-sm ${
                isMe
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-slate-700 text-slate-100 rounded-bl-sm'
              }`}>
                {msg.text}
              </div>
              <span className="text-xs text-slate-600 mt-1 mx-1">
                {new Date(msg.timestamp).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-700 p-3 flex items-center gap-2 bg-slate-900">
        <input
          className="flex-1 bg-slate-800 border border-slate-600 rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          placeholder="Mesaj yaz... (Enter ile gönder)"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          maxLength={300}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="p-2.5 rounded-xl bg-blue-600 text-white disabled:opacity-40 hover:bg-blue-500 transition-colors"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

export default ChatScreen
