'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadConfig, getMessages, pushMessage, saveMessages } from '@/lib/storage';
import type { StoredConfig, StoredMessage } from '@/lib/storage';

type MessageType = 'text' | 'audio' | 'image';

export default function ChatInterface() {
  const [messages, setMessages] = useState<StoredMessage[]>(() => getMessages());
  const [inputText, setInputText] = useState('');
  const [config, setConfig] = useState<StoredConfig | null>(null);
  const pollingRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const c = loadConfig();
    setConfig(c);

    const onCfg = () => setConfig(loadConfig());
    window.addEventListener('whatsapp-config-updated', onCfg);
    return () => window.removeEventListener('whatsapp-config-updated', onCfg);
  }, []);

  useEffect(() => {
    // persist messages in sessionStorage
    saveMessages(messages);
    // scroll to bottom
    setTimeout(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }, 50);
  }, [messages]);

  useEffect(() => {
    // start polling for inbound messages every 3s when config exists
    function startPolling() {
      if (!config?.phone) return;
      if (pollingRef.current) return;
      const id = window.setInterval(async () => {
        try {
          const res = await fetch(`/api/receive-from-n8n?phone=${encodeURIComponent(config.phone)}`);
          if (!res.ok) return;
          const json = await res.json();
          if (json?.messages && Array.isArray(json.messages) && json.messages.length) {
            const newMsgs: StoredMessage[] = json.messages.map((m: any) => ({
              id: m.id,
              text: String(m.message),
              sender: 'bot',
              timestamp: m.timestamp ?? new Date().toISOString(),
              status: 'sent',
            }));
            setMessages((prev) => {
              const merged = [...prev, ...newMsgs];
              saveMessages(merged);
              return merged;
            });
          }
        } catch (err) {
          // ignore polling errors
        }
      }, 3000);
      pollingRef.current = id;
    }

    function stopPolling() {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }

    if (config?.phone) startPolling();
    else stopPolling();
    return stopPolling;
  }, [config]);

  const canSend = Boolean(config?.webhookUrl?.trim());

  const headerSubtitle = useMemo(() => {
    if (!config) return 'Configura el webhook para empezar';
    if (!config.webhookUrl?.trim()) return 'Configura el webhook para empezar';
    return `De: ${config.phone} • Contacto: ${config.name}`;
  }, [config]);

  const sendToN8n = async (text: string) => {
    if (!config) return;
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const msg: StoredMessage = { id, text, sender: 'user', timestamp: new Date().toISOString(), status: 'sending' };
    setMessages((prev) => {
      const out = [...prev, msg];
      saveMessages(out);
      return out;
    });

    try {
      const res = await fetch('/api/send-to-n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: config.webhookUrl, message: text, phone: config.phone, name: config.name }),
      });
      if (!res.ok) throw new Error('send failed');
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'sent' } : m)));
    } catch (err) {
      setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'error' } : m)));
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    void sendToN8n(inputText.trim());
    setInputText('');
  };

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="bg-green-600 p-4 text-white">
        <div className="text-lg font-semibold">Simulador WhatsApp</div>
        <div className="text-sm opacity-90">{headerSubtitle}</div>
      </div>

      <div ref={containerRef} className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">
        {messages.length === 0 ? (
          <div className="mt-10 text-center text-gray-400">No hay mensajes. Envía uno para probar.</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={msg.sender === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-xs rounded-lg p-3 ${msg.sender === 'user' ? 'bg-green-100' : 'bg-white'}`}
              >
                <p className="text-sm">{msg.text}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                  {msg.sender === 'user' && msg.status === 'sending' && ' Enviando...'}
                  {msg.sender === 'user' && msg.status === 'sent' && ' ✓✓'}
                  {msg.sender === 'user' && msg.status === 'error' && ' ❌'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t bg-gray-100 p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
            placeholder="Escribe un mensaje..."
            className="flex-1 rounded border p-2"
            disabled={!canSend}
          />
          <button
            onClick={handleSendText}
            disabled={!canSend}
            className="rounded bg-green-600 px-6 py-2 font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Enviar
          </button>
        </div>
        {!canSend && <div className="mt-2 text-xs text-gray-600">Configura el webhook para habilitar el envío.</div>}
      </div>
    </div>
  );
}

