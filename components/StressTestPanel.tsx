"use client"

import { useEffect, useRef, useState } from "react"
import { subscribeToMessages, type Message } from "@/lib/firebase-client"
import type { Unsubscribe } from "firebase/database"
import { loadConfig } from "@/lib/storage"

const TIMEOUT_MS = 10 * 60 * 1000 // 10 minutos
const REFRESH_INTERVAL_MS = 5000 // 5 segundos después de cargar

type TestState = {
  phonesTracked: Set<string>
  startTime: number
  loadTime: number | null
  responseMap: Map<string, number>
}

export default function StressTestPanel() {
  const [numUsers, setNumUsers] = useState(100)
  const [messagesPerUser, setMessagesPerUser] = useState(1)
  const [intervalMs, setIntervalMs] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const unsubscribeRef = useRef<Unsubscribe | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
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
  
  const testStateRef = useRef<TestState | null>(null)
  const startTimeRef = useRef<number>(0)

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

  const handleIntervalChange = (value: string) => {
    const num = Number.parseInt(value, 10)
    if (!isNaN(num)) {
      setIntervalMs(Math.max(0, num))
    }
  }

  const calculateMetrics = () => {
    if (!testStateRef.current) return

    const { responseMap, phonesTracked } = testStateRef.current
    let lessThan1s = 0
    let lessThan5s = 0
    let lessThan30s = 0

    for (const responseTime of responseMap.values()) {
      if (responseTime < 1000) lessThan1s++
      else if (responseTime < 5000) lessThan5s++
      else if (responseTime < 30000) lessThan30s++
    }

    const success = responseMap.size
    const errors = summary?.error ?? 0
    const total = phonesTracked.size
    const noResponse = total - success - errors

    return {
      lessThan1s,
      lessThan5s,
      lessThan30s,
      noResponse: Math.max(0, noResponse),
      errors,
      success,
    }
  }

  const allResponded = () => {
    if (!testStateRef.current) return false
    const { phonesTracked, responseMap } = testStateRef.current
    const errors = summary?.error ?? 0
    return responseMap.size + errors === phonesTracked.size
  }

  const startListeningToFirebase = () => {
    if (!testStateRef.current) return
    if (unsubscribeRef.current) {
      unsubscribeRef.current()
    }

    try {
      const unsubscribe = subscribeToMessages((fbMessages: Message[]) => {
        let updated = false

        for (const msg of fbMessages) {
          if (msg.direction === 'inbound' && testStateRef.current?.phonesTracked.has(msg.phone)) {
            if (!testStateRef.current.responseMap.has(msg.phone)) {
              const responseTime = new Date(msg.timestamp).getTime() - testStateRef.current.startTime
              testStateRef.current.responseMap.set(msg.phone, responseTime)
              updated = true
            }
          }
        }

        if (updated && testStateRef.current?.loadTime) {
          const newMetrics = calculateMetrics()
          if (newMetrics) {
            setMetrics(newMetrics)
          }
        }
      })

      unsubscribeRef.current = unsubscribe
    } catch (err) {
      console.error('Error escuchando Firebase:', err)
    }
  }

  // Timer que se actualiza cada frame del navegador (60fps) para mejor fluidez
  useEffect(() => {
    if (!isLoading || !startTimeRef.current) return

    let animationFrameId: number

    const updateTimer = () => {
      const now = Date.now()
      const elapsed = now - startTimeRef.current
      setElapsedMs(elapsed)
      animationFrameId = requestAnimationFrame(updateTimer)
    }

    animationFrameId = requestAnimationFrame(updateTimer)

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId)
    }
  }, [isLoading])

  // Cleanup de timers al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current)
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
      }
    }
  }, [])

  const handleRunTest = async () => {
    const cfg = loadConfig()
    if (!cfg?.webhookUrl?.trim()) {
      alert("⚠️ Webhook not configured in the Configuration section")
      return
    }
    const webhookUrl = cfg.webhookUrl.trim()

    setIsLoading(true)
    setShowResults(false)
    setSummary(null)
    setMetrics(null)
    setElapsedMs(0)

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      const startTime = Date.now()
      startTimeRef.current = startTime

      const response = await fetch("/api/stress-test-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numUsers: Number(numUsers),
          messagesPerUser: Number(messagesPerUser),
          intervalMs: Number(intervalMs),
          webhookUrl,
        }),
        signal: controller.signal,
      })

      const data = await response.json()

      if (response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const phonesTracked = new Set(data.results.map((r: any) => r.phone)) as Set<string>
        
        testStateRef.current = {
          phonesTracked,
          startTime,
          loadTime: null,
          responseMap: new Map(),
        }

        setSummary({
          total: data.totalSent,
          success: 0,
          error: data.errorCount,
          duration: 0,
        })

        try {
          window.dispatchEvent(
            new CustomEvent("stress-test-results", {
              detail: {
                results: data.results || [],
                summary: { total: data.totalSent, success: 0, error: data.errorCount },
              },
            }),
          )
        } catch {
          // ignore
        }

        // El timer se maneja automáticamente via useEffect cuando isLoading = true
        startListeningToFirebase()

        // Esperar a que todos respondan o timeout
        const waitForAllResponses = () => {
          return new Promise<void>((resolve) => {
            const checkInterval = setInterval(() => {
              const now = Date.now()
              const timeoutReached = now - startTime > TIMEOUT_MS
              const finished = allResponded()

              if (finished || timeoutReached) {
                clearInterval(checkInterval)
                console.log('[Check] Test finished or timeout. Finished:', finished, 'Timeout:', timeoutReached)

                // Detener timer solo si terminó
                if (finished) {
                  console.log('[Timer] Deteniendo timer porque terminó')
                  if (timerRef.current !== null) {
                    clearInterval(timerRef.current)
                    timerRef.current = null
                  }
                } else {
                  console.log('[Timer] Continuando porque llegó timeout pero no todos respondieron')
                }

                const finalElapsed = now - startTime
                setElapsedMs(finalElapsed)

                const metricsCalc = calculateMetrics()
                if (metricsCalc) {
                  setSummary({
                    total: testStateRef.current?.phonesTracked.size ?? 0,
                    success: metricsCalc.success,
                    error: metricsCalc.errors,
                    duration: finalElapsed,
                  })
                  setMetrics(metricsCalc)
                }

                if (testStateRef.current) {
                  testStateRef.current.loadTime = now
                }

                setShowResults(true)

                if (timeoutReached && !finished) {
                  console.log('[Refresh] Iniciando refresh automático cada 5s')
                  const refreshId = setInterval(() => {
                    const now = Date.now()
                    const elapsed = now - startTime
                    setElapsedMs(elapsed)
                    const metricsRefresh = calculateMetrics()
                    if (metricsRefresh) {
                      setMetrics(metricsRefresh)
                    }
                  }, REFRESH_INTERVAL_MS)
                  refreshTimerRef.current = refreshId
                }

                resolve()
              }
            }, 100)
          })
        }

        await waitForAllResponses()
      } else {
        alert(`❌ Error: ${data.error || "Unknown error"}`)
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Test stopped by user')
      } else {
        alert(`❌ Error: ${err instanceof Error ? err.message : "Unknown error"}`)
      }
    } finally {
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleStopTest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const totalMessages = numUsers * messagesPerUser

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    const centiseconds = Math.floor((ms % 1000) / 10)
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(centiseconds).padStart(2, "0")}`
  }

  return (
    <div className="space-y-lg">
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

          <div className="form-group">
            <label className="form-label">Interval (ms)</label>
            <input
              type="number"
              min="0"
              step="100"
              value={intervalMs}
              onChange={(e) => handleIntervalChange(e.target.value)}
              disabled={isLoading}
              className="input"
              placeholder="0 = simultaneous"
            />
            <p className="body-text" style={{ marginTop: "var(--space-xs)", color: "var(--text-secondary)", fontSize: "var(--text-xs)" }}>
              Delay between message batches
            </p>
          </div>

          <div className="metric-card">
            <div className="metric-label">Total Messages</div>
            <div className="metric-value">{totalMessages.toLocaleString()}</div>
          </div>

          <button onClick={handleRunTest} disabled={isLoading} className="btn btn-primary" style={{ width: "100%" }}>
            {isLoading ? "Running..." : "Start Test"}
          </button>

          {isLoading && (
            <button onClick={handleStopTest} className="btn btn-danger-dark" style={{ width: "100%" }}>
              Stop Test
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <div className="panel neon-border-warning">
          <div className="panel-header">
            <h2 className="panel-title">Waiting for Responses...</h2>
          </div>

          <div className="space-y-lg">
            <div className="metric-card" style={{ textAlign: "center", padding: "var(--space-xl)" }}>
              <div className="metric-label" style={{ fontSize: "var(--text-sm)" }}>
                Elapsed Time
              </div>
              <div
                className="metric-value"
                style={{
                  fontSize: "3em",
                  fontWeight: "bold",
                  color: "var(--accent-warning)",
                  fontFamily: "monospace",
                }}
              >
                {formatTime(elapsedMs)}
              </div>
              <div className="label-text" style={{ marginTop: "var(--space-md)", fontSize: "var(--text-xs)" }}>
                (Max 10:00.00)
              </div>
            </div>

            <p className="body-text" style={{ textAlign: "center", color: "var(--text-secondary)" }}>
              Esperando respuestas de {numUsers * messagesPerUser} mensajes...
            </p>

            <button onClick={handleStopTest} className="btn btn-danger-dark" style={{ width: "100%" }}>
              Stop Test
            </button>
          </div>
        </div>
      )}

      {showResults && summary && (
        <div className="panel neon-border-warning">
          <div className="panel-header">
            <h2 className="panel-title">Results</h2>
          </div>

          <div className="space-y-lg">
            <div className="metric-card">
              <div className="metric-label">Total Time</div>
              <div className="metric-value">{formatTime(elapsedMs)}</div>
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
                setShowResults(false)
                setSummary(null)
                setMetrics(null)
                testStateRef.current = null
                if (unsubscribeRef.current) {
                  unsubscribeRef.current()
                  unsubscribeRef.current = null
                }
                if (refreshTimerRef.current) {
                  clearInterval(refreshTimerRef.current)
                  refreshTimerRef.current = null
                }
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
