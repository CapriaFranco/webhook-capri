"use client";

import { useEffect, useState } from "react";
import { saveConfig, loadConfig } from "@/lib/storage";

export default function ConfigPanel() {
  const cfg = loadConfig();
  const [webhookUrl, setWebhookUrl] = useState(cfg?.webhookUrl ?? "");
  const [phone, setPhone] = useState(cfg?.phone ?? "5491131264254");
  const [name, setName] = useState(cfg?.name ?? "Test User");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onUpdated = () => {
      const c = loadConfig();
      setWebhookUrl(c?.webhookUrl ?? "");
      setPhone(c?.phone ?? "5491131264254");
      setName(c?.name ?? "Test User");
    };
    window.addEventListener("whatsapp-config-updated", onUpdated);
    return () => window.removeEventListener("whatsapp-config-updated", onUpdated);
  }, []);

  const save = () => {
    saveConfig({ webhookUrl: webhookUrl.trim(), phone: phone.trim(), name: name.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const isWebhookConfigured = Boolean(webhookUrl.trim());

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Configuración</h2>
        <div
          className={
            "rounded-full px-2 py-1 text-xs font-medium " +
            (isWebhookConfigured ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")
          }
        >
          {isWebhookConfigured ? "✓ Configuración guardada" : "Webhook no configurado"}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium">URL del Webhook n8n</label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://tu-instancia.app.n8n.cloud/webhook/..."
            className="w-full rounded border p-2"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Tu número de teléfono</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="5491131264254"
              className="w-full rounded border p-2"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">Tu nombre</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Test User"
              className="w-full rounded border p-2"
            />
          </div>
        </div>

        <button onClick={save} className="w-full rounded bg-green-600 p-2 font-medium text-white hover:bg-green-700">
          {saved ? "Guardado ✓" : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}

