'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'whatsapp-simulator-config';

type SimulatorConfig = {
  webhookUrl: string;
  phoneNumber: string;
  contactName: string;
};

export default function ConfigPanel() {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('5491131264254');
  const [contactName, setContactName] = useState('Test User');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem(STORAGE_KEY);
    if (!savedConfig) return;

    try {
      const config = JSON.parse(savedConfig) as Partial<SimulatorConfig>;
      setWebhookUrl(config.webhookUrl ?? '');
      setPhoneNumber(config.phoneNumber ?? '5491131264254');
      setContactName(config.contactName ?? 'Test User');
    } catch {
      // ignore invalid localStorage value
    }
  }, []);

  const saveConfig = () => {
    const config: SimulatorConfig = { webhookUrl, phoneNumber, contactName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new Event('whatsapp-simulator-config-updated'));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isWebhookConfigured = Boolean(webhookUrl.trim());

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Configuración</h2>
        <div
          className={[
            'rounded-full px-2 py-1 text-xs font-medium',
            isWebhookConfigured ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600',
          ].join(' ')}
        >
          {isWebhookConfigured ? 'Webhook configurado' : 'Webhook no configurado'}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">URL del Webhook n8n</label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://tu-instancia.app.n8n.cloud/webhook/360dialog-in"
            className="w-full rounded border p-2"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Número (from)</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="5491131264254"
              className="w-full rounded border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Nombre del contacto</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Test User"
              className="w-full rounded border p-2"
            />
          </div>
        </div>

        <button
          onClick={saveConfig}
          className="w-full rounded bg-green-600 p-2 font-medium text-white hover:bg-green-700"
        >
          {saved ? 'Guardado' : 'Guardar configuración'}
        </button>
      </div>
    </div>
  );
}

