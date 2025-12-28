"use client"

import { useState } from "react"
import { loadConfig } from "@/lib/storage"

type TestResult = {
  phone: string
  userName: string
  message: string
  status: "pending" | "sent" | "success" | "error" | "no_response"
  response: string
  n8nResponse?: string
  timestamp: string
  waitTime?: number
  responseTime?: number
}

export default function StressTestPanel() {
  const [numUsers, setNumUsers] = useState(100)
  const [messagesPerUser, setMessagesPerUser] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  // results are emitted to the ResultsPanel via event; no local storage needed
  const [summary, setSummary] = useState<{
    total: number
    success: number
    error: number
    duration: number
  } | null>(null)
  const [metrics, setMetrics] = useState<{
    lessThan1s: number
    lessThan5s: number
    moreThan5s: number
    noResponse: number
    errors: number
  } | null>(null)

  const handleNumUsersChange = (value: string) => {
    const num = Number.parseInt(value, 10)
    if (!isNaN(num)) {
      setNumUsers(Math.max(1, Math.min(10000000, num)))
    }
  }

  const handleMessagesChange = (value: string) => {
    const num = Number.parseInt(value, 10)
    if (!isNaN(num)) {
      setMessagesPerUser(Math.max(1, Math.min(10, num)))
    }
  }

  const handleRunTest = async () => {
    const cfg = loadConfig()
    if (!cfg?.webhookUrl?.trim()) {
      alert("⚠️ Webhook no configurado en la sección de Configuración")
      return
    }
    const webhookUrl = cfg.webhookUrl.trim()

    setIsLoading(true)
    setSummary(null)
    setMetrics(null)

    try {
      const startTime = Date.now()
      const response = await fetch("/api/stress-test-send", {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numUsers: Number(numUsers),
          messagesPerUser: Number(messagesPerUser),
          webhookUrl,
          waitForResponses: true,
          waitMs: 5000,
        }),
      })

      const data = await response.json()
      const duration = Date.now() - startTime

      if (response.ok) {
        setSummary({
          total: data.totalSent,
          success: data.successCount,
          error: data.errorCount,
          duration,
        })
        try {
          window.dispatchEvent(
            new CustomEvent("stress-test-results", {
              detail: {
                results: data.results || [],
                summary: { total: data.totalSent, success: data.successCount, error: data.errorCount, duration },
              },
            }),
          )
        } catch {
          // ignore
        }
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setIsLoading(false)
      // ignore
    }
  }

  const totalMessages = numUsers * messagesPerUser

  return (
    <div className="space-y-lg">
      {/* Stress Test Control Panel */}
      <div className="panel neon-border-warning">
        <div className="panel-header">
          <h2 className="panel-title">Stress Test</h2>
        </div>

        <div className="space-y-lg">
          <div className="form-group">
            <label className="form-label">Usuarios</label>
            <input
              type="number"
              min="1"
              max="10000000"
              value={numUsers}
              onChange={(e) => handleNumUsersChange(e.target.value)}
              disabled={isLoading}
              className="input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Mensajes por Usuario</label>
            <input
              type="number"
              min="1"
              max="10"
              value={messagesPerUser}
              onChange={(e) => handleMessagesChange(e.target.value)}
              disabled={isLoading}
              className="input"
            />
          </div>

          <div className="metric-card">
            <div className="metric-label">Total de Mensajes</div>
            <div className="metric-value">{totalMessages.toLocaleString()}</div>
          </div>

          <button onClick={handleRunTest} disabled={isLoading} className="btn btn-primary" style={{ width: "100%" }}>
            {isLoading ? "Ejecutando..." : "Iniciar Test"}
          </button>
        </div>
      </div>

      {/* Results Panel */}
      {summary && (
        <div className="panel neon-border-warning">
          <div className="panel-header">
            <h2 className="panel-title">Resultados</h2>
          </div>

          <div className="space-y-lg">
            <div className="metric-card">
              <div className="metric-label">Tiempo Total</div>
              <div className="metric-value">{(summary.duration / 1000).toFixed(2)}s</div>
            </div>

            {metrics && (
              <div>
                <div className="label-text" style={{ marginBottom: "var(--space-md)" }}>
                  Tiempos de Respuesta
                </div>
                <div className="grid-2">
                  <div className="metric-card">
                    <div className="metric-label">{"< 1s"}</div>
                    <div className="metric-value metric-value-sm">{metrics.lessThan1s}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">{"< 5s"}</div>
                    <div className="metric-value metric-value-sm">{metrics.lessThan5s}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">{"> 5s"}</div>
                    <div className="metric-value metric-value-sm">{metrics.moreThan5s}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Sin Respuesta</div>
                    <div className="metric-value metric-value-sm">{metrics.noResponse}</div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="label-text" style={{ marginBottom: "var(--space-md)" }}>
                Estados
              </div>
              <div className="grid-3">
                <div className="metric-card">
                  <div className="metric-label">Éxito</div>
                  <div className="metric-value metric-value-sm">{summary.success}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Errores</div>
                  <div className="metric-value metric-value-sm">{summary.error}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Total</div>
                  <div className="metric-value metric-value-sm">{summary.total}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
