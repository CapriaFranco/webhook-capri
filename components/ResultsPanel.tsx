"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { subscribeToMessages, type Message } from "@/lib/firebase-client"
import type { Unsubscribe } from "firebase/database"

type TestResult = {
  phone: string
  userName: string
  message: string
  status: string
  n8nResponse?: string
  responseTime?: number
  timestamp?: string
  sentAt?: number
}

export default function ResultsPanel() {
  const [results, setResults] = useState<TestResult[]>([])
  const [tooltip, setTooltip] = useState<{ show: boolean; content: string; x: number; y: number }>({
    show: false,
    content: "",
    x: 0,
    y: 0,
  })
  const resultsMapRef = useRef<Map<string, TestResult>>(new Map())
  const phonesTrackedRef = useRef<Set<string>>(new Set())
  const unsubscribeRef = useRef<Unsubscribe | null>(null)

  const startListeningToFirebase = useCallback(() => {
    // Si ya hay un listener, desuscribirse
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    // Escuchar TODOS los mensajes y filtrar por phones tracked
    try {
      const unsubscribe = subscribeToMessages((fbMessages: Message[]) => {
        let updated = false;

        for (const msg of fbMessages) {
          // Solo procesar si es una respuesta inbound para un phone que enviamos
          if (msg.direction === 'inbound' && phonesTrackedRef.current.has(msg.phone)) {
            const result = resultsMapRef.current.get(msg.phone);
            if (result) {
              // Actualizar la respuesta
              result.n8nResponse = msg.message;
              result.status = msg.message.toLowerCase().includes('error') ? 'error' : 'success';
              
              // Calcular responseTime
              if (result.sentAt) {
                result.responseTime = msg.timestamp ? new Date(msg.timestamp).getTime() - result.sentAt : undefined;
              }
              
              updated = true;
            }
          }
        }

        // Re-renderizar si hubo cambios
        if (updated) {
          setResults(Array.from(resultsMapRef.current.values()));
        }
      });
      
      unsubscribeRef.current = unsubscribe;
    } catch (err) {
      console.error('Error escuchando Firebase:', err);
    }
  }, [])

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      const detail = custom?.detail;
      if (!detail) return;
      const newResults = detail.results || [];
      
      // Guardar results en un mapa por phone para actualizaciones rápidas
      const newMap = new Map<string, TestResult>();
      for (const result of newResults) {
        newMap.set(result.phone, result);
      }
      resultsMapRef.current = newMap;
      
      // Guardar phones tracked para filtrar en Firebase
      const phones = new Set(newResults.map((r: TestResult) => r.phone))
      phonesTrackedRef.current = phones as Set<string>
      
      setResults(newResults);
      
      // Escuchar cambios en Firebase para los phones enviados
      startListeningToFirebase();
    };
    
    const clearHandler = () => {
      setResults([]);
      resultsMapRef.current.clear();
      phonesTrackedRef.current.clear();
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
    
    window.addEventListener('stress-test-results', handler as EventListener);
    window.addEventListener('clear-stress-results', clearHandler as EventListener);
    
    return () => {
      window.removeEventListener('stress-test-results', handler as EventListener);
      window.removeEventListener('clear-stress-results', clearHandler as EventListener);
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  const handleTooltip = (e: React.MouseEvent<HTMLSpanElement>, content: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({
      show: true,
      content,
      x: rect.left,
      y: rect.bottom + 4,
    })
  }

  const handleTooltipHide = () => {
    setTooltip({ ...tooltip, show: false })
  }

  if (results.length === 0) return null

  return (
    <div className="panel neon-border-neutral" style={{ display: "flex", flexDirection: "column", height: "100%", zIndex: 2 }}>
      <div className="panel-header">
        <h2 className="panel-title">Results Details</h2>
        <p className="body-text" style={{ marginTop: "var(--space-xs)" }}>
          {results.filter(r => r.status !== 'pending').length} / {results.length} respondieron
        </p>
      </div>

      <div className="data-table-container table-scroll" style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
        <table className="data-table">
          <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Status</th>
              <th>Time</th>
              <th>Phone</th>
              <th>Duration</th>
              <th>In.</th>
              <th>Output</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td className="mono-text" style={{ width: "70px" }}>{i + 1}</td>
                <td style={{ width: "120px" }}>{r.userName}</td>
                <td style={{ width: "100px" }}>
                  <div
                    className={`status-indicator ${
                      r.status === "success"
                        ? "status-success"
                        : r.status === "error"
                          ? "status-danger"
                          : "status-warning"
                    }`}
                  >
                    <span className="status-dot"></span>
                    <span>{r.status}</span>
                  </div>
                </td>
                <td className="mono-text" style={{ width: "100px" }}>{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "-"}</td>
                <td className="mono-text" style={{ width: "140px" }}>{r.phone}</td>
                <td className="mono-text" style={{ width: "90px" }}>{typeof r.responseTime === "number" ? `${r.responseTime}ms` : "-"}</td>
                <td style={{ width: "50px" }}>
                  <span
                    onMouseEnter={(e) => handleTooltip(e, r.message)}
                    onMouseLeave={handleTooltipHide}
                    style={{ cursor: "pointer", fontSize: "1.3em" }}
                  >
                    ⋮
                  </span>
                </td>
                <td style={{ flex: 1, minWidth: "200px", maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "var(--space-md)" }}>
                  <span
                    onMouseEnter={(e) => handleTooltip(e, r.n8nResponse || "No response")}
                    onMouseLeave={handleTooltipHide}
                    style={{ cursor: "pointer" }}
                  >
                    {r.n8nResponse ? r.n8nResponse.substring(0, 60) + (r.n8nResponse.length > 60 ? "..." : "") : "-"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tooltip.show && (
        <div
          style={{
            position: "fixed",
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            background: "var(--bg-elevated)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-md)",
            maxWidth: "400px",
            wordWrap: "break-word",
            zIndex: 1000,
            fontSize: "var(--text-xs)",
            color: "var(--text-primary)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}
