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
          {/* Left column: Chat + Results */}
          <section className="space-y-lg">
            <ChatInterface />
            <ResultsPanel />
          </section>

          {/* Right column: Config + Stress Test panels */}
          <aside className="space-y-lg">
            <ConfigPanel />
            <StressTestPanel />
          </aside>
        </main>
      </div>
    </div>
  )
}
