"use client";

import { useEffect, useState } from "react";
import { saveConfig, loadConfig } from "@/lib/storage";
import { Settings, CheckCircle } from '@/components/Icons';

export default function ConfigPanel() {
  const [mounted, setMounted] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  // Cargar config al montar (lado cliente)
  useEffect(() => {
    const cfg = loadConfig();
    setWebhookUrl(cfg?.webhookUrl ?? "");
    setPhone(cfg?.phone ?? "5491131264254");
    setName(cfg?.name ?? "Test User");
    setMounted(true);

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

  // No renderizar hasta que esté montado en cliente (evita hydration mismatch)
  if (!mounted) {
    return (
      <div className="rounded-lg panel p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-lg card-title"><Settings className="inline-block mr-2" size={16} />Configuración</h2>
          <div className="rounded-full px-2 py-1 text-xs font-medium bg-white/5 muted">Cargando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg panel p-4 neon-panel">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold"><Settings className="inline-block mr-2" size={16} />Configuración</h2>
        <div className={"rounded-full px-2 py-1 text-xs font-medium " + (isWebhookConfigured ? "bg-white/5 text-accent" : "bg-white/5 muted")}>
          {isWebhookConfigured ? (<span className="flex items-center gap-2"><CheckCircle size={14} />Configuración guardada</span>) : "Webhook no configurado"}
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm small-muted">URL del Webhook n8n</label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://tu-instancia.app.n8n.cloud/webhook/..."
            className="w-full rounded p-2 bg-transparent border border-white/5"
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

        <button onClick={save} className="w-full rounded btn btn-primary p-2 font-medium">
          {saved ? "Guardado ✓" : "Guardar configuración"}
        </button>
      </div>
    </div>
  );
}

