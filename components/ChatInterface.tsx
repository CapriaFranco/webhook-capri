'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadConfig } from '@/lib/storage';
import type { StoredConfig } from '@/lib/storage';
import {
  subscribeToPhoneMessages,
  saveMessage,
  unsubscribeFromMessages,
  clearPhoneMessages,
  filterMessagesByDateRange,
  type Message,
} from '@/lib/firebase-client';
import type { Unsubscribe } from 'firebase/database';

type StoredMessage = Message & {
  status?: 'sending' | 'sent' | 'error';
};

type MessageType = 'text' | 'audio' | 'image';

export default function ChatInterface() {
  const [allMessages, setAllMessages] = useState<StoredMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [config, setConfig] = useState<StoredConfig | null>(null);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const c = loadConfig();
    setConfig(c);

    const onCfg = () => setConfig(loadConfig());
    window.addEventListener('whatsapp-config-updated', onCfg);
    return () => window.removeEventListener('whatsapp-config-updated', onCfg);
  }, []);

  // Filtrar mensajes por rango de fechas
  const messages = useMemo(() => {
    let filtered = [...allMessages];
    if (startDate || endDate) {
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      filtered = filterMessagesByDateRange(filtered, start, end);
    }
    return filtered;
  }, [allMessages, startDate, endDate]);

  // Scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      if (!containerRef.current) return;
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }, 50);
  }, [messages]);

  // Subscribe to Firebase messages for current phone
  useEffect(() => {
    if (!config?.phone) return;

    try {
      const unsubscribe = subscribeToPhoneMessages(config.phone, (fbMessages) => {
        setAllMessages(fbMessages.map((m) => ({ ...m, status: 'sent' as const })));
      });
      unsubscribeRef.current = unsubscribe;
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeFromMessages(unsubscribeRef.current);
          unsubscribeRef.current = null;
        }
      };
    } catch (err) {
      console.error('Error subscribing to Firebase:', err);
    }
  }, [config?.phone]);

  const canSend = Boolean(config?.webhookUrl?.trim());

  const headerSubtitle = useMemo(() => {
    if (!config) return 'Configura el webhook para empezar';
    if (!config.webhookUrl?.trim()) return 'Configura el webhook para empezar';
    return `De: ${config.phone} • Contacto: ${config.name}`;
  }, [config]);

  const sendToN8n = async (text: string) => {
    if (!config) return;

    const timestamp = new Date().toISOString();

    // 1. Guardar en Firebase inmediatamente (lo más importante)
    try {
      await saveMessage({
        message: text,
        phone: config.phone,
        timestamp,
        direction: 'outbound',
      });
      console.log('[ChatInterface] Message saved to Firebase');
    } catch (firebaseErr) {
      console.error('[ChatInterface] Error saving to Firebase:', firebaseErr);
      return;
    }

    // 2. Enviar a n8n en paralelo (opcional, no bloquea)
    if (config.webhookUrl) {
      fetch('/api/send-to-n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: config.webhookUrl,
          message: text,
          phone: config.phone,
          name: config.name,
        }),
      }).catch((err) => {
        console.warn('[ChatInterface] Warning: Failed to send to n8n webhook:', err);
        // No es crítico si falla - el mensaje ya está en Firebase
      });
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    void sendToN8n(inputText.trim());
    setInputText('');
  };

  const handleClearChat = async () => {
    if (!config?.phone) return;
    if (!window.confirm('¿Estás seguro de que quieres borrar todos los mensajes de este número?')) return;
    try {
      await clearPhoneMessages(config.phone);
      setAllMessages([]);
    } catch (err) {
      console.error('Error clearing messages:', err);
    }
  };

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="bg-green-600 p-4 text-white">
        <div className="text-lg font-semibold">Simulador WhatsApp</div>
        <div className="text-sm opacity-90">{headerSubtitle}</div>
      </div>

      {/* Filtro de fechas */}
      <div className="border-b bg-gray-50 p-3">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700">Desde:</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-700">Hasta:</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <button
            onClick={() => {
              setStartDate('');
              setEndDate('');
            }}
            className="mt-5 rounded bg-gray-400 px-3 py-1 text-xs text-white hover:bg-gray-500"
          >
            Limpiar filtro
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">
        {messages.length === 0 ? (
          <div className="mt-10 text-center text-gray-400">No hay mensajes. Envía uno para probar.</div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={msg.direction === 'outbound' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-xs rounded-lg p-3 ${msg.direction === 'outbound' ? 'bg-green-100' : 'bg-white'}`}
              >
                <p className="text-sm">{msg.message}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                  {msg.direction === 'outbound' && msg.status === 'sending' && ' Enviando...'}
                  {msg.direction === 'outbound' && msg.status === 'sent' && ' ✓✓'}
                  {msg.direction === 'outbound' && msg.status === 'error' && ' ❌'}
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
          <button
            onClick={handleClearChat}
            className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            title="Borrar todos los mensajes"
          >
            🗑️ Limpiar
          </button>
        </div>
        {!canSend && <div className="mt-2 text-xs text-gray-600">Configura el webhook para habilitar el envío.</div>}
      </div>
    </div>
  );
}

