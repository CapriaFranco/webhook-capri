'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { loadConfig } from '@/lib/storage';
import type { StoredConfig } from '@/lib/storage';
import { subscribeToPhoneMessages, saveMessage, unsubscribeFromMessages, type Message } from '@/lib/firebase-client';
import type { Unsubscribe } from 'firebase/database';

type StoredMessage = Message & {
  status?: 'sending' | 'sent' | 'error';
};

type MessageType = 'text' | 'audio' | 'image';

export default function ChatInterface() {
  const [messages, setMessages] = useState<StoredMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [config, setConfig] = useState<StoredConfig | null>(null);
  const unsubscribeRef = useRef<Unsubscribe | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const c = loadConfig();
    setConfig(c);

    const onCfg = () => setConfig(loadConfig());
    window.addEventListener('whatsapp-config-updated', onCfg);
    return () => window.removeEventListener('whatsapp-config-updated', onCfg);
  }, []);

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
        setMessages(fbMessages.map((m) => ({ ...m, status: 'sent' as const })));
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
    const id = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const newMsg: StoredMessage = {
      id,
      message: text,
      phone: config.phone,
      sender: 'user',
      timestamp: new Date().toISOString(),
      direction: 'outbound',
      status: 'sending',
    };

    // Mostrar localmente antes de enviar
    setMessages((prev) => [...prev, newMsg]);

    try {
      // Guardar en Firebase
      await saveMessage({
        message: text,
        phone: config.phone,
        timestamp: new Date().toISOString(),
        direction: 'outbound',
      });

      // Enviar a n8n
      const res = await fetch('/api/send-to-n8n', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: config.webhookUrl,
          message: text,
          phone: config.phone,
          name: config.name,
        }),
      });
      if (!res.ok) throw new Error('send failed');
    } catch (err) {
      console.error('Error sending message:', err);
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
        </div>
        {!canSend && <div className="mt-2 text-xs text-gray-600">Configura el webhook para habilitar el envío.</div>}
      </div>
    </div>
  );
}

