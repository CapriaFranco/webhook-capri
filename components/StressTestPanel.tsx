"use client"

import { useState } from "react"
import { loadConfig } from "@/lib/storage"

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
    lessThan30s: number
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
      alert("⚠️ Webhook not configured in the Configuration section")
      return
    }
    const webhookUrl = cfg.webhookUrl.trim()

    setIsLoading(true)
    setSummary(null)
    setMetrics(null)

    try {
      const startTime = Date.now()
      const response = await fetch("/api/stress-test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numUsers: Number(numUsers),
          messagesPerUser: Number(messagesPerUser),
          webhookUrl,
          waitForResponses: true,
          waitMs: 300000, // 5 minutos para flujos complejos de n8n
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
          // set metrics if provided by the API
          if (data.metrics) {
            setMetrics({
              lessThan1s: data.metrics.lessThan1s ?? 0,
              lessThan5s: data.metrics.lessThan5s ?? 0,
              lessThan30s: data.metrics.lessThan30s ?? 0,
              noResponse: data.metrics.noResponse ?? 0,
              errors: data.metrics.errors ?? 0,
            })
          }
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

    // timing ranges will be read from `metrics` returned by the API

  return (
    <div className="space-y-lg">
      {/* Stress Test Control Panel */}
      <div className="panel neon-border-warning">
        <div className="panel-header">
          <h2 className="panel-title">Stress Test</h2>
        </div>

        <div className="space-y-lg">
          <div className="form-group">
            <label className="form-label">Users</label>
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
            <label className="form-label">Messages per User</label>
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
            <div className="metric-label">Total Messages</div>
            <div className="metric-value">{totalMessages.toLocaleString()}</div>
          </div>

          <button onClick={handleRunTest} disabled={isLoading} className="btn btn-primary" style={{ width: "100%" }}>
            {isLoading ? "Running..." : "Start Test"}
          </button>
        </div>
      </div>

      {/* Results Panel */}
      {summary && (
        <div className="panel neon-border-warning">
          <div className="panel-header">
            <h2 className="panel-title">Results</h2>
          </div>

          <div className="space-y-lg">
            <div className="metric-card">
              <div className="metric-label">Total Time</div>
              <div className="metric-value">{(summary.duration / 1000).toFixed(2)}s</div>
            </div>

            {metrics && (
              <div>
                <div className="label-text" style={{ marginBottom: "var(--space-md)" }}>
                  Time Ranges
                </div>
                <div className="grid-3">
                  <div className="metric-card">
                    <div className="metric-label">&lt; 1s</div>
                    <div className="metric-value">{metrics.lessThan1s}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">&lt; 5s</div>
                    <div className="metric-value">{metrics.lessThan5s}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">&lt; 30s</div>
                    <div className="metric-value">{metrics.lessThan30s ?? 0}</div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <div className="label-text" style={{ marginBottom: "var(--space-md)" }}>
                Status
              </div>
              <div className="grid-3">
                <div className="metric-card">
                  <div className="metric-label">Success</div>
                  <div className="metric-value metric-value-sm">{summary.success}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Errors</div>
                  <div className="metric-value metric-value-sm">{summary.error}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">No Response</div>
                  <div className="metric-value metric-value-sm">{metrics?.noResponse ?? 0}</div>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                setSummary(null)
                setMetrics(null)
                try {
                  window.dispatchEvent(new CustomEvent("clear-stress-results"))
                } catch {
                }
              }}
              className="btn btn-secondary"
              style={{ width: "100%" }}
            >
              Clear Results
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
