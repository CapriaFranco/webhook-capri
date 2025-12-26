import ConfigPanel from '@/components/ConfigPanel';
import ChatInterface from '@/components/ChatInterface';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold">📱 Simulador WhatsApp - n8n</h1>
          <div className="text-sm text-gray-600">Prueba flujos de n8n sin WhatsApp real</div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1">
            <ConfigPanel />
          </div>

          <div className="lg:col-span-2">
            <ChatInterface />
          </div>
        </div>
      </div>
    </div>
  );
}
