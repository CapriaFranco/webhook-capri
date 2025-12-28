import ConfigPanel from '@/components/ConfigPanel';
import ChatInterface from '@/components/ChatInterface';
import StressTestPanel from '@/components/StressTestPanel';

export default function Home() {
  return (
    <div className="min-h-screen p-6">
      <div className="container-compact">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">📱 Simulador WhatsApp - n8n</h1>
          <div className="text-sm muted">Prueba flujos de n8n sin WhatsApp real</div>
        </header>

        <main className="app-grid">
          <section className="space-y-6">
            <ChatInterface />
          </section>

          <aside className="space-y-6">
            <ConfigPanel />
            <StressTestPanel />
          </aside>
        </main>
      </div>
    </div>
  );
}
