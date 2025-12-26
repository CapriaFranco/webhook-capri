'use client';

import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'whatsapp-simulator-config';

type MessageType = 'text' | 'audio' | 'image';
type MessageStatus = 'sending' | 'sent' | 'error';

type SimulatorConfig = {
  webhookUrl: string;
  phoneNumber: string;
  contactName: string;
};

type Message = {
  id: string;
  type: MessageType;
  content: string;
  timestamp: Date;
  status: MessageStatus;
};

function loadConfig(): SimulatorConfig | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SimulatorConfig;
  } catch {
    return null;
  }
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [config, setConfig] = useState<SimulatorConfig | null>(null);

  useEffect(() => {
    const updateConfig = () => setConfig(loadConfig());
    updateConfig();

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) updateConfig();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('whatsapp-simulator-config-updated', updateConfig);

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('whatsapp-simulator-config-updated', updateConfig);
    };
  }, []);

  const canSend = Boolean(config?.webhookUrl?.trim());

  const headerSubtitle = useMemo(() => {
    if (!config) return 'Configura el webhook para empezar';
    if (!config.webhookUrl?.trim()) return 'Configura el webhook para empezar';
    return `De: ${config.phoneNumber} • Contacto: ${config.contactName}`;
  }, [config]);

  const sendWebhook = async (type: MessageType, content: string) => {
    if (!config?.webhookUrl?.trim()) {
      alert('Configura primero la URL del webhook');
      return;
    }

    const messageId = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const newMessage: Message = {
      id: messageId,
      type,
      content,
      timestamp: new Date(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, newMessage]);

    try {
      const response = await fetch('/api/send-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: config.webhookUrl,
          messageType: type,
          content,
          from: config.phoneNumber,
          contactName: config.contactName,
        }),
      });

      if (!response.ok) throw new Error('Webhook failed');

      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status: 'sent' } : msg))
      );
    } catch {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === messageId ? { ...msg, status: 'error' } : msg))
      );
    }
  };

  const handleSendText = () => {
    if (!inputText.trim()) return;
    void sendWebhook('text', inputText.trim());
    setInputText('');
  };

  const handleSendAudio = () => void sendWebhook('audio', 'Audio simulado');
  const handleSendImage = () => void sendWebhook('image', 'https://via.placeholder.com/300');

  return (
    <div className="flex h-[600px] flex-col overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="bg-green-600 p-4 text-white">
        <div className="text-lg font-semibold">Simulador WhatsApp</div>
        <div className="text-sm opacity-90">{headerSubtitle}</div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto bg-gray-50 p-4">
        {messages.length === 0 ? (
          <div className="mt-10 text-center text-gray-400">
            No hay mensajes. Envía uno para probar.
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-xs rounded-lg bg-green-100 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium">{msg.type}</span>
                </div>

                {msg.type === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={msg.content}
                    alt="Imagen"
                    className="mb-2 max-h-48 w-full rounded object-cover"
                  />
                ) : (
                  <p className="text-sm">{msg.content}</p>
                )}

                <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                  {msg.timestamp.toLocaleTimeString()}
                  {msg.status === 'sending' && '...'}
                  {msg.status === 'sent' && '✓✓'}
                  {msg.status === 'error' && 'error'}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t bg-gray-100 p-4">
        <div className="mb-2 flex gap-2">
          <button
            onClick={handleSendAudio}
            disabled={!canSend}
            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Audio
          </button>
          <button
            onClick={handleSendImage}
            disabled={!canSend}
            className="rounded bg-purple-600 px-4 py-2 text-white hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Imagen
          </button>
        </div>

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

        {!canSend && (
          <div className="mt-2 text-xs text-gray-600">Configura el webhook para habilitar el envío.</div>
        )}
      </div>
    </div>
  );
}

