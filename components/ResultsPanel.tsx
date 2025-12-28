"use client"

import { useEffect, useState } from "react"

type TestResult = {
  phone: string
  userName: string
  message: string
  status: string
  n8nResponse?: string
  responseTime?: number
  timestamp?: string
}

export default function ResultsPanel() {
  const [results, setResults] = useState<TestResult[]>([])

  useEffect(() => {
    const handler = (e: Event) => {
      const custom = e as CustomEvent;
      const detail = custom?.detail;
      if (!detail) return;
      setResults(detail.results || []);
    };
    window.addEventListener('stress-test-results', handler as EventListener);
    return () => window.removeEventListener('stress-test-results', handler as EventListener);
  }, []);

  if (results.length === 0) return null

  return (
    <div className="panel neon-border-neutral">
      <div className="panel-header">
        <h2 className="panel-title">Detalle de Resultados</h2>
        <p className="body-text" style={{ marginTop: "var(--space-xs)" }}>
          {results.length} resultados
        </p>
      </div>

      <div className="data-table-container table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>Estado</th>
              <th>Hora</th>
              <th>Número</th>
              <th>Tiempo</th>
              <th>Mensaje</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td className="mono-text">{i + 1}</td>
                <td>{r.userName}</td>
                <td>
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
                <td className="mono-text">{r.timestamp ? new Date(r.timestamp).toLocaleTimeString() : "-"}</td>
                <td className="mono-text">{r.phone}</td>
                <td className="mono-text">{typeof r.responseTime === "number" ? `${r.responseTime}ms` : "-"}</td>
                <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.message}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
