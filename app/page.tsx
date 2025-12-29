import ConfigPanel from "@/components/ConfigPanel"
import ChatInterface from "@/components/ChatInterface"
import StressTestPanel from "@/components/StressTestPanel"
import TopToolbar from "@/components/TopToolbar"
import ResultsPanel from "@/components/ResultsPanel"

export default function Home() {
  return (
    <div className="page-container">
      <div className="content-wrapper">
        <header className="space-y-lg" style={{ marginBottom: "var(--space-2xl)" }}>
          <h1 className="heading-1">Webhook Simulator</h1>
          <TopToolbar />
        </header>

        <main className="app-grid">
          {/* Top row: Chat + Configuration */}
          <div className="grid-row grid-hsection">
            <section>
              <ChatInterface />
            </section>
            <aside>
              <ConfigPanel />
            </aside>
          </div>

          {/* Bottom row: Results + Stress Test */}
          <div className="grid-row grid-haside" style={{ position: "relative" }}>
            <section>
              <ResultsPanel />
              <div style={{ position: "absolute", top: "31%", left: "31%", zIndex: 1, margin: "auto", color: "var(--text-secondary)", fontSize: "3.2101rem" }}>
                :)
              </div>
            </section>
            <aside>
              <StressTestPanel />
            </aside>
          </div>

           {/* Bottom row: Results + Stress Test */}
          <div className="grid-row grid-haside">
            <section className="panel neon-border-neutral" style={{ padding: "var(--space-2xl)", textAlign: "center" }}>
              <h2 className="panel-title">Coming Soon...</h2>
              <p className="body-text" style={{ marginTop: "var(--space-md)", color: "var(--text-secondary)" }}>
                More features are on the way
              </p>
            </section>  
            <aside className="panel neon-border-neutral" style={{ padding: "var(--space-2xl)", textAlign: "center" }}>
              <h3 className="body-text" style={{ marginTop: "var(--space-md)", color: "var(--text-secondary)", fontSize: "1.62101rem" }}>
                :)
              </h3>
            </aside>
          </div>

          {/* Coming Soon section */}
          <section className="panel neon-border-neutral" style={{ marginTop: "var(--space-2xl)", padding: "var(--space-2xl)", textAlign: "center" }}>
            <h2 className="panel-title">Coming Soon...</h2>
            <p className="body-text" style={{ marginTop: "var(--space-md)", color: "var(--text-secondary)" }}>
              More features are on the way :)
            </p>
          </section>          
        </main>
      </div>
    </div>
  )
}
