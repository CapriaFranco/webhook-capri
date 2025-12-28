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
  const [tooltip, setTooltip] = useState<{ show: boolean; content: string; x: number; y: number }>({
    show: false,
    content: "",
    x: 0,
    y: 0,
  })

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
    <div className="panel neon-border-neutral">
      <div className="panel-header">
        <h2 className="panel-title">Results Details</h2>
        <p className="body-text" style={{ marginTop: "var(--space-xs)" }}>
          {results.length} results
        </p>
      </div>

      <div className="data-table-container table-scroll">
        <table className="data-table">
          <thead>
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
                    title="Ver mensaje enviado"
                  >
                    ⋮
                  </span>
                </td>
                <td style={{ flex: 1, minWidth: "200px", maxWidth: "400px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: "var(--space-md)" }}>
                  <span
                    onMouseEnter={(e) => handleTooltip(e, r.n8nResponse || "No response")}
                    onMouseLeave={handleTooltipHide}
                    style={{ cursor: "pointer" }}
                    title="View full response"
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
