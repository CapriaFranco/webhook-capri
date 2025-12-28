'use client';

import { useState } from 'react';

type TestResult = {
  phone: string;
  userName: string;
  message: string;
  status: 'pending' | 'sent' | 'success' | 'error' | 'no_response';
  response: string;
  n8nResponse?: string; // Respuesta del flujo n8n si la hay
  timestamp: string;
  waitTime?: number; // ms que tardó la petición al webhook
  responseTime?: number; // Tiempo total desde envío hasta respuesta
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
  const [metrics, setMetrics] = useState<{
    lessThan1s: number;
    lessThan5s: number;
    moreThan5s: number;
    noResponse: number;
    errors: number;
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
    setMetrics(null);

    try {
      const startTime = Date.now();
      const response = await fetch('/api/stress-test-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numUsers: Number(numUsers),
          messagesPerUser: Number(messagesPerUser),
          webhookUrl: webhookUrl.trim(),
          waitForResponses: true, // Esperar respuestas del flujo n8n
          waitMs: 5000, // Esperar 5 segundos para que n8n procese
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
        setMetrics(data.metrics || null);
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

  // Paginación de resultados (100 por página)
  const [page, setPage] = useState(0);
  const pageSize = 100;
  const totalPages = Math.ceil(results.length / pageSize);
  const pagedResults = results.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rounded-lg border border-orange-300 bg-orange-50 p-6">
      <h3 className="mb-4 text-lg font-semibold text-orange-900">🧪 Prueba de Estrés</h3>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inputs - Left column */}
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
        </div>

        {/* Métricas - Right column */}
        <div>
          {summary && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-3">
              <div className="font-semibold text-blue-900 mb-4">📊 Resultados</div>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded bg-white p-2 text-center">
                  <div className="text-xs text-gray-600">Total</div>
                  <div className="text-lg font-bold text-blue-600">{summary.total}</div>
                </div>
                <div className="rounded bg-white p-2 text-center">
                  <div className="text-xs text-gray-600">Duración</div>
                  <div className="text-lg font-bold text-blue-600">{(summary.duration / 1000).toFixed(1)}s</div>
                </div>
              </div>

              {/* Response Timing Metrics */}
              {metrics && (
                <div className="space-y-2 border-t pt-3">
                  <div className="text-sm font-semibold text-blue-900">⏱️ Tiempos de Respuesta:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded bg-green-100 p-2">
                      <div className="text-xs text-green-700">
                        <span className="font-bold">{metrics.lessThan1s}</span> en &lt;1s
                      </div>
                    </div>
                    <div className="rounded bg-blue-100 p-2">
                      <div className="text-xs text-blue-700">
                        <span className="font-bold">{metrics.lessThan5s}</span> en &lt;5s
                      </div>
                    </div>
                    <div className="rounded bg-yellow-100 p-2">
                      <div className="text-xs text-yellow-700">
                        <span className="font-bold">{metrics.moreThan5s}</span> en &gt;5s
                      </div>
                    </div>
                    <div className="rounded bg-orange-100 p-2">
                      <div className="text-xs text-orange-700">
                        <span className="font-bold">{metrics.noResponse}</span> Sin respuesta
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Summary */}
              <div className="border-t pt-3 space-y-2">
                <div className="text-sm font-semibold text-blue-900">✅ Estado:</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded bg-green-100 p-2 text-center">
                    <div className="text-green-700">
                      <span className="font-bold text-lg">{summary.success}</span>
                      <div>Éxito</div>
                    </div>
                  </div>
                  <div className="rounded bg-red-100 p-2 text-center">
                    <div className="text-red-700">
                      <span className="font-bold text-lg">{summary.error}</span>
                      <div>Error</div>
                    </div>
                  </div>
                  <div className="rounded bg-gray-100 p-2 text-center">
                    <div className="text-gray-700">
                      <span className="font-bold text-lg">{(metrics?.noResponse || 0)}</span>
                      <div>Sin resp.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resultados detallados - Full width below */}
      {summary && (
        <div className="mt-6 space-y-4">
          <div className="font-semibold text-lg text-gray-900">📋 Detalles de Resultados</div>
          
          <div className="rounded bg-blue-50 p-3 text-xs text-blue-800">
            <strong>💡 Info:</strong> Envía mensajes reales con números aleatorios al webhook de n8n. Verás los
            resultados en el panel de Executions de n8n.
          </div>

          {/* Lista de resultados con paginación */}
          {results.length > 0 && (
            <div className="mt-4 space-y-3">
              <h5 className="font-semibold text-gray-800">Detalle de envíos (página {page + 1}/{totalPages}):</h5>
              <div className="max-h-96 space-y-1 overflow-y-auto rounded border border-gray-200 bg-white p-2">
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
                        <span className="font-semibold">Mensaje:</span> &quot;{result.message.substring(0, 30)}&hellip;&quot;
                      </div>
                      <div>
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            result.status === 'success'
                              ? 'bg-green-500'
                              : result.status === 'error'
                                ? 'bg-red-500'
                                : result.status === 'no_response'
                                  ? 'bg-orange-500'
                                  : 'bg-yellow-500'
                          }`}
                        ></span>
                        <span className="ml-1 font-semibold text-xs">
                          {result.status === 'success'
                            ? '✅ Éxito'
                            : result.status === 'error'
                              ? '❌ Error'
                              : result.status === 'no_response'
                                ? '⚠️ Sin respuesta'
                                : '⏳ Pendiente'}
                        </span>
                      </div>
                    </div>
                    {result.n8nResponse ? (
                      <div className="mt-2 bg-blue-50 rounded p-2 text-xs border border-blue-200">
                        <div className="font-semibold text-blue-700 mb-1">✅ Respuesta del flujo n8n:</div>
                        <pre className="text-blue-700 whitespace-pre-wrap break-words overflow-auto max-h-32 text-xs">
                          {result.n8nResponse}
                        </pre>
                      </div>
                    ) : result.status === 'no_response' ? (
                      <div className="mt-2 bg-orange-50 rounded p-2 text-xs border border-orange-200">
                        <div className="font-semibold text-orange-600 mb-1">⚠️ No se recibió respuesta del flujo n8n</div>
                        <p className="text-orange-700">El flujo n8n no devolvió respuesta después de esperar 5 segundos</p>
                      </div>
                    ) : null}
                    {typeof result.responseTime === 'number' && (
                      <div className="mt-1 text-gray-500 text-xs">
                        ⏱️ Tiempo de respuesta: {result.responseTime} ms
                      </div>
                    )}
                  </div>
                ))}
                {/* Pagination controls */}
                <div className="flex justify-between py-2 text-xs text-gray-600 border-t">
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
      )}
    </div>
  );
}
