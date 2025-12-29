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

  const respondedCount = results.filter(r => r.status !== 'pending').length
  const totalCount = results.length

  return (
    <div className="results-panel">
      <header className="results-panel-header">
        <h2 className="results-panel-title">Results Details</h2>
        <p className="results-panel-subtitle">
          {respondedCount} / {totalCount} respondieron
        </p>
      </header>

      <div className="results-table-wrapper">
        <table className="results-table">
          <thead className="results-table-head">
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
          <tbody className="results-table-body">
            {results.map((result, index) => {
              const statusClass = 
                result.status === "success" ? "status-success" :
                result.status === "error" ? "status-danger" :
                "status-warning"

              const formattedTime = result.timestamp 
                ? new Date(result.timestamp).toLocaleTimeString() 
                : "-"

              const formattedDuration = typeof result.responseTime === "number" 
                ? `${result.responseTime}ms` 
                : "-"

              const outputText = result.n8nResponse 
                ? (result.n8nResponse.length > 60 
                    ? result.n8nResponse.substring(0, 60) + "..." 
                    : result.n8nResponse)
                : "-"

              return (
                <tr key={index} className="results-table-row">
                  <td className="results-table-cell results-table-cell-id">
                    {index + 1}
                  </td>
                  <td className="results-table-cell results-table-cell-user">
                    {result.userName}
                  </td>
                  <td className="results-table-cell results-table-cell-status">
                    <div className={`status-indicator ${statusClass}`}>
                      <span className="status-dot"></span>
                      <span>{result.status}</span>
                    </div>
                  </td>
                  <td className="results-table-cell results-table-cell-time">
                    {formattedTime}
                  </td>
                  <td className="results-table-cell results-table-cell-phone">
                    {result.phone}
                  </td>
                  <td className="results-table-cell results-table-cell-duration">
                    {formattedDuration}
                  </td>
                  <td className="results-table-cell results-table-cell-input">
                    <span
                      className="results-table-trigger results-table-trigger-icon"
                      onMouseEnter={(e) => handleTooltip(e, result.message)}
                      onMouseLeave={handleTooltipHide}
                    >
                      ⋮
                    </span>
                  </td>
                  <td className="results-table-cell results-table-cell-output">
                    <span
                      className="results-table-trigger results-table-trigger-text"
                      onMouseEnter={(e) => handleTooltip(e, result.n8nResponse || "No response")}
                      onMouseLeave={handleTooltipHide}
                    >
                      {outputText}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {tooltip.show && (
        <div
          className="results-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}
