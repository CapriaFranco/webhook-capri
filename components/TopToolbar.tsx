"use client"

import { useState } from "react"

export default function TopToolbar() {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")

  const updateFilter = (newFrom: string, newTo: string) => {
    setFrom(newFrom)
    setTo(newTo)
    try {
      window.dispatchEvent(new CustomEvent("filter-date-updated", { detail: { from: newFrom, to: newTo } }))
      } catch {
      }
  }

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <label className="label-text">From</label>
        <input
          className="input"
          style={{ width: "200px" }}
          type="datetime-local"
          value={from}
          onChange={(e) => updateFilter(e.target.value, to)}
        />
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <label className="label-text">To</label>
        <input
          className="input"
          style={{ width: "200px" }}
          type="datetime-local"
          value={to}
          onChange={(e) => updateFilter(from, e.target.value)}
        />
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group" style={{ display: "flex", gap: "var(--space-md)" }}>
        <button
          className="btn btn-danger-dark"
          onClick={() => {
            if (!confirm("This will clear the entire database. Are you sure?")) return
            try {
              window.dispatchEvent(new CustomEvent("clear-all-db"))
            } catch {
            }
          }}
        >
          Clear Database
        </button>

        <div className="toolbar-separator" />

        <button
          className="btn btn-danger"
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent("clear-chat"))
            } catch {
            }
          }}
        >
          Clear Chat
        </button>
      </div>
    </div>
  )
}
