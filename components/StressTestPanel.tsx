'use client';

import { useState } from 'react';

type TestResult = {
  phone: string;
  userName: string;
  message: string;
  status: 'pending' | 'sent' | 'success' | 'error';
  response: string;
  timestamp: string;
  waitTime?: number; // ms que tardó la petición al webhook
};

export default function StressTestPanel() {
  const [numUsers, setNumUsers] = useState(100);
  const [messagesPerUser, setMessagesPerUser] = useState(1);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    success: number;
    error: number;
    duration: number;
  } | null>(null);

  const handleNumUsersChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setNumUsers(Math.max(1, Math.min(10000000, num)));
    }
  };

  const handleMessagesChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num)) {
      setMessagesPerUser(Math.max(1, Math.min(10, num)));
    }
  };

  const handleRunTest = async () => {
    if (!webhookUrl.trim()) {
      alert('⚠️ Debes ingresar la URL del webhook de n8n');
      return;
    }

    setIsLoading(true);
    setResults([]);
    setSummary(null);

    try {
      const startTime = Date.now();
      const response = await fetch('/api/stress-test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numUsers: Number(numUsers),
          messagesPerUser: Number(messagesPerUser),
          webhookUrl: webhookUrl.trim(),
        }),
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (response.ok) {
        setResults(data.results || []);
        setSummary({
          total: data.totalSent,
          success: data.successCount,
          error: data.errorCount,
          duration,
        });
      } else {
        alert(`❌ Error: ${data.error}`);
      }
    } catch (err) {
      alert(`❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const totalMessages = numUsers * messagesPerUser;
  const successResults = results.filter((r) => r.status === 'success').length;
  const errorResults = results.filter((r) => r.status === 'error').length;

  // Paginación de resultados (100 por página)
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const totalPages = Math.ceil(results.length / pageSize);
  const pagedResults = results.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rounded-lg border border-orange-300 bg-orange-50 p-6">
      <h3 className="mb-4 text-lg font-semibold text-orange-900">🧪 Prueba de Estrés</h3>

      <div className="space-y-4">
        {/* Webhook URL */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            URL del Webhook n8n:
          </label>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            disabled={isLoading}
            placeholder="ej: https://webhook.site/xxxxx"
            className="mt-2 w-full rounded border px-3 py-2 text-sm"
          />
        </div>

        {/* Usuarios (Input numérico) */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Número de usuarios: <span className="font-bold text-orange-600">{numUsers.toLocaleString()}</span>
          </label>
          <input
            type="number"
            min="1"
            max="10000000"
            value={numUsers}
            onChange={(e) => handleNumUsersChange(e.target.value)}
            disabled={isLoading}
            className="mt-2 w-full rounded border px-3 py-2"
          />
          <div className="text-xs text-gray-500">Máx: 10.000.000 usuarios</div>
        </div>

        {/* Mensajes por usuario */}
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Mensajes por usuario: <span className="font-bold text-orange-600">{messagesPerUser}</span>
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value={messagesPerUser}
            onChange={(e) => handleMessagesChange(e.target.value)}
            disabled={isLoading}
            className="mt-2 w-full rounded border px-3 py-2"
          />
          <div className="text-xs text-gray-500">Máx: 10 mensajes/usuario</div>
        </div>

        {/* Resumen */}
        <div className="rounded bg-orange-100 p-3 text-center">
          <div className="text-sm text-gray-700">Total de mensajes a enviar:</div>
          <div className="text-2xl font-bold text-orange-600">{totalMessages.toLocaleString()}</div>
        </div>

        {/* Botón */}
        <button
          onClick={handleRunTest}
          disabled={isLoading}
          className="w-full rounded bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Enviando pruebas...' : '▶️ Ejecutar Prueba'}
        </button>

        {/* Resumen de resultados */}
        {summary && (
          <div className="rounded-lg border border-blue-300 bg-blue-50 p-4">
            <div className="font-semibold text-blue-900">📊 Resultados</div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <div>
                <div className="text-gray-600">Total enviados</div>
                <div className="text-xl font-bold text-blue-600">{summary.total}</div>
              </div>
              <div>
                <div className="text-gray-600">✅ Exitosos</div>
                <div className="text-xl font-bold text-green-600">{summary.success}</div>
              </div>
              <div>
                <div className="text-gray-600">❌ Errores</div>
                <div className="text-xl font-bold text-red-600">{summary.error}</div>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              ⏱️ Duración: {(summary.duration / 1000).toFixed(2)}s
            </div>
          </div>
        )}

        {/* Info */}
        <div className="rounded bg-blue-50 p-3 text-xs text-blue-800">
          <strong>💡 Info:</strong> Envía mensajes reales con números aleatorios al webhook de n8n. Verás los
          resultados en el panel de Executions de n8n.
        </div>
      </div>

      {/* Lista de resultados (compacta) */}
      {results.length > 0 && (
        <div className="mt-6">
          <h4 className="mb-3 font-semibold text-gray-800">📋 Detalle de envíos (página {page + 1}/{totalPages}):</h4>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {pagedResults.map((result, idx) => (
              <div
                key={idx}
                className="rounded border border-gray-200 bg-white px-3 py-2 text-xs font-mono"
              >
                <div className="flex gap-3">
                  <div className="w-24">
                    <span className="font-semibold">Número:</span> {result.phone}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold">Usuario:</span> {result.userName}
                  </div>
                  <div className="flex-1">
                    <span className="font-semibold">Mensaje:</span> "{result.message.substring(0, 30)}..."
                  </div>
                  <div>
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        result.status === 'success'
                          ? 'bg-green-500'
                          : result.status === 'error'
                            ? 'bg-red-500'
                            : 'bg-yellow-500'
                      }`}
                    ></span>
                    <span className="ml-1 font-semibold">
                      {result.status === 'success'
                        ? '✅ Éxito'
                        : result.status === 'error'
                          ? '❌ Error'
                          : '⏳ Pendiente'}
                    </span>
                  </div>
                </div>
                {result.response && (
                  <div className="mt-1 text-gray-600">
                    <span className="font-semibold">Respuesta:</span> {result.response.substring(0, 60)}
                    {result.response.length > 60 ? '...' : ''}
                  </div>
                )}
                {typeof result.waitTime === 'number' && (
                  <div className="mt-1 text-gray-500 text-xs">
                    ⏱️ Tiempo de espera: {result.waitTime} ms
                  </div>
                )}
              </div>
            ))}
            {/* Pagination controls */}
            <div className="flex justify-between py-2 text-xs text-gray-600">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(p - 1, 0))}
                className="rounded bg-gray-200 px-2 py-1 disabled:opacity-50"
              >
                ← Anterior
              </button>
              <span>
                Página {page + 1} de {totalPages}
              </span>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => Math.min(p + 1, totalPages - 1))}
                className="rounded bg-gray-200 px-2 py-1 disabled:opacity-50"
              >
                Siguiente →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
