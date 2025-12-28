"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { loadConfig } from "@/lib/storage"
import type { StoredConfig } from "@/lib/storage"
import {
  subscribeToPhoneMessages,
  saveMessage,
  unsubscribeFromMessages,
  clearPhoneMessages,
  filterMessagesByDateRange,
  type Message,
} from "@/lib/firebase-client"
import type { Unsubscribe } from "firebase/database"

type StoredMessage = Message & {
  status?: "sending" | "sent" | "error"
}

export default function ChatInterface() {
  const [allMessages, setAllMessages] = useState<StoredMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [config, setConfig] = useState<StoredConfig | null>(() => loadConfig())
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const unsubscribeRef = useRef<Unsubscribe | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const onCfg = () => setConfig(loadConfig())
    window.addEventListener("whatsapp-config-updated", onCfg)
    return () => window.removeEventListener("whatsapp-config-updated", onCfg)
  }, [])

  // Clear chat handler (moved up so effects can reference it)
  const handleClearChat = useCallback(async () => {
    if (!config?.phone) return
    if (!window.confirm("Are you sure you want to delete all messages from this number?")) return
    try {
      await clearPhoneMessages(config.phone)
      setAllMessages([])
    } catch (err) {
      console.error("Error clearing messages:", err)
    }
  }, [config])

  // Listen to toolbar and stress-test events
  useEffect(() => {
    const onFilter = (e: Event) => {
      const custom = e as CustomEvent
      const d = custom?.detail
      if (!d) return
      setStartDate(d.from || "")
      setEndDate(d.to || "")
    }
    const onClear = () => {
      void handleClearChat()
    }
    window.addEventListener("filter-date-updated", onFilter as EventListener)
    window.addEventListener("clear-chat", onClear as EventListener)
    return () => {
      window.removeEventListener("filter-date-updated", onFilter as EventListener)
      window.removeEventListener("clear-chat", onClear as EventListener)
    }
  }, [handleClearChat])

  // Filtrar mensajes por rango de fechas
  const messages = useMemo(() => {
    let filtered = [...allMessages]
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null
      const end = endDate ? new Date(endDate) : null
      filtered = filterMessagesByDateRange(filtered, start, end)
    }
    return filtered
  }, [allMessages, startDate, endDate])

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      if (!containerRef.current) return
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }, 50)
  }, [messages])

  // Subscribe to Firebase messages for current phone
  useEffect(() => {
    if (!config?.phone) return

    try {
      const unsubscribe = subscribeToPhoneMessages(config.phone, (fbMessages) => {
        setAllMessages(fbMessages.map((m) => ({ ...m, status: "sent" as const })))
      })
      unsubscribeRef.current = unsubscribe
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeFromMessages(unsubscribeRef.current)
          unsubscribeRef.current = null
        }
      }
    } catch (err) {
      console.error("Error subscribing to Firebase:", err)
    }
  }, [config?.phone])

  const canSend = Boolean(config?.phone)

  const sendToN8n = async (text: string) => {
    if (!config?.phone) return

    const timestamp = new Date().toISOString()

    try {
      await saveMessage({
        message: text,
        phone: config.phone,
        timestamp,
        direction: "outbound",
      })
    } catch (firebaseErr) {
      console.error("[ChatInterface] Error saving to Firebase:", firebaseErr)
      return
    }

    // Enviar a n8n solo si webhook está configurado
    if (config.webhookUrl?.trim()) {
      fetch("/api/send-to-n8n", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          webhookUrl: config.webhookUrl,
          message: text,
          phone: config.phone,
          name: config.name,
        }),
      }).catch((err) => {
        console.warn("[ChatInterface] Warning: Failed to send to n8n webhook:", err)
      })
    }
  }

  const handleSendText = () => {
    if (!inputText.trim()) return
    void sendToN8n(inputText.trim())
    setInputText("")
  }


  return (
    <div className="chat-container neon-border-neutral">

      {/* Messages Display */}
      <div ref={containerRef} className="chat-messages">
        {messages.length === 0 ? (
          <div className="text-secondary" style={{ textAlign: "center", padding: "var(--space-3xl) 0" }}>
            No messages
          </div>
        ) : (
          <div className="space-y-md">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-item ${msg.direction === "outbound" ? "user" : "bot"}`}>
                <div className={`message-bubble ${msg.direction === "outbound" ? "bubble-user" : "bubble-bot"}`}>
                  <div className="message-content">{msg.message}</div>
                </div>

                <div className="message-footer">
                  <div className={`message-time ${msg.direction === "outbound" ? "time-right" : "time-left"}`}>{new Date(msg.timestamp).toLocaleTimeString()}</div>
                  {msg.direction === "outbound" && (
                    <div className={`status-indicator ${msg.status === "sent" ? "status-success" : msg.status === "error" ? "status-danger" : "status-warning"}`} style={{ gap: "6px" }}>
                      <span className="status-dot"></span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Small inline status info below chat (subtle) */}
      <div style={{ marginTop: "var(--space-sm)", fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
        <span style={{ marginRight: "var(--space-md)", marginLeft: "var(--space-xl)" }}>Status:</span>
        <span style={{ marginRight: "var(--space-sm)", display: "inline-flex", alignItems: "center" }}>
          <span className="status-indicator status-danger"><span className="status-dot"></span><span style={{ marginLeft: "6px" }}>Error</span></span>
        </span>
        <span style={{ marginRight: "var(--space-sm)", display: "inline-flex", alignItems: "center" }}>
          <span className="status-indicator status-warning"><span className="status-dot"></span><span style={{ marginLeft: "6px" }}>Waiting</span></span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          <span className="status-indicator status-success"><span className="status-dot"></span><span style={{ marginLeft: "6px" }}>Received</span></span>
        </span>
      </div>

      {/* Input + Send Button inline */}
      <div className="chat-footer" style={{ display: "flex", gap: "var(--space-sm)", marginTop: "var(--space-md)" }}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSendText()}
          placeholder="Type a message..."
          className="input"
          style={{ flex: 1, height: 44 }}
        />
        <button
          onClick={handleSendText}
          disabled={!inputText.trim()}
          className="btn btn-primary"
          style={{ width: 160 }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
