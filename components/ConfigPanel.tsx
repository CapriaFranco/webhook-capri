"use client"

import { useEffect, useState } from "react"
import { saveConfig, loadConfig } from "@/lib/storage"

export default function ConfigPanel() {
  const [mounted, setMounted] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    try {
      const c = typeof window !== 'undefined' ? loadConfig() : null;
      return c?.webhookUrl ?? '';
    } catch {
      return '';
    }
  });
  const [phone, setPhone] = useState<string>(() => {
    try {
      const c = typeof window !== 'undefined' ? loadConfig() : null;
      return c?.phone ?? '5491101234567';
    } catch {
      return '5491101234567';
    }
  });
  const [name, setName] = useState<string>(() => {
    try {
      const c = typeof window !== 'undefined' ? loadConfig() : null;
      return c?.name ?? 'user';
    } catch {
      return 'user';
    }
  });
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    // mark mounted; initial values were set in state initializers
    setMounted(true)

    const onUpdated = () => {
      const c = loadConfig()
      setWebhookUrl(c?.webhookUrl ?? "")
      setPhone(c?.phone ?? "5491101234567")
      setName(c?.name ?? "user")
    }
    window.addEventListener("whatsapp-config-updated", onUpdated)
    return () => window.removeEventListener("whatsapp-config-updated", onUpdated)
  }, [])

  const save = () => {
    saveConfig({ webhookUrl: webhookUrl.trim(), phone: phone.trim(), name: name.trim() })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!mounted) {
    return (
      <div className="panel neon-border-neutral">
        <div className="panel-title">Configuración</div>
      </div>
    )
  }

  return (
    <div className="panel neon-border-neutral">
      <div className="panel-header">
        <h2 className="panel-title">Configuración</h2>
      </div>

      <div className="space-y-lg">
        <div className="form-group">
          <label className="form-label">URL Webhook</label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="http://localhost:5678/webhook/..."
            className="input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Número</label>
          <input
            type="text"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="5491101234567"
            className="input"
          />
        </div>

        <div className="form-group">
          <label className="form-label">Nombre Usuario</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Usuario"
            className="input"
          />
        </div>

        <button onClick={save} className="btn btn-secondary" style={{ width: "100%" }}>
          {saved ? "✓ Guardado" : "Guardar"}
        </button>
      </div>
    </div>
  )
}
