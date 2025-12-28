'use client';

import { useState, useEffect } from 'react';
import { loadConfig } from '@/lib/storage';
import { Zap, Clock } from '@/components/Icons';

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
    // if webhook not provided, try to read from config
    if (!webhookUrl.trim()) {
      const cfg = loadConfig();
      if (!cfg?.webhookUrl?.trim()) {
        alert('⚠️ Webhook no configurado en la sección de Configuración');
        return;
      }
      setWebhookUrl(cfg.webhookUrl.trim());
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

  useEffect(() => {
    const cfg = loadConfig();
    if (cfg?.webhookUrl) setWebhookUrl(cfg.webhookUrl);
  }, []);

  return (
    <div className="stress-hero neon-panel">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg card-title flex items-center gap-2"><Zap className="inline-block" size={18} />Prueba de Estrés</h3>
        <div className="badge">ESTRÉS</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inputs - Left column */}
        <div className="space-y-4">
        {/* Webhook: use config (no editable here) */}
        <div>
          <label className="block text-sm small-muted">Webhook (desde Configuración)</label>
          <div className="mt-2 rounded p-2 border border-white/5 text-sm">{webhookUrl || 'No configurado'}</div>
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
          className="w-full rounded btn-primary px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <span><Clock className="inline-block mr-2" size={16} />Enviando pruebas...</span>
          ) : (
            <span><Zap className="inline-block mr-2" size={16} />Ejecutar Prueba</span>
          )}
        </button>
        </div>

        {/* Métricas - Right column */}
        <div>
          {summary && (
            <div className="rounded-lg border border-blue-300 bg-blue-50 p-4 space-y-3">
              <div className="font-semibold text-blue-900 mb-4">Resultados</div>
              
              {/* Summary Stats */}
              <div className="grid grid-cols-2 gap-3">
                  <div className="rounded bg-white/3 p-2 text-center">
                  <div className="text-xs muted">Total</div>
                  <div className="text-lg font-bold">{summary.total}</div>
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
                    <div className="rounded p-2 metric">
                      <div className="value">{metrics.lessThan1s}</div>
                      <div className="muted text-xs">en &lt;1s</div>
                    </div>
                    <div className="rounded p-2 metric">
                      <div className="value">{metrics.lessThan5s}</div>
                      <div className="muted text-xs">en &lt;5s</div>
                    </div>
                    <div className="rounded p-2 metric">
                      <div className="value">{metrics.moreThan5s}</div>
                      <div className="muted text-xs">en &gt;5s</div>
                    </div>
                    <div className="rounded p-2 metric">
                      <div className="value">{metrics.noResponse}</div>
                      <div className="muted text-xs">Sin respuesta</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Summary */}
              <div className="border-t pt-3 space-y-2">
                  <div className="text-sm font-semibold">Estado:</div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded bg-green-100 p-2 text-center">
                      <div className="text-green-400">
                      <div className="font-bold text-lg">{summary.success}</div>
                      <div className="text-xs muted">Éxito</div>
                    </div>
                  </div>
                  <div className="rounded bg-red-100 p-2 text-center">
                      <div className="text-red-400">
                      <div className="font-bold text-lg">{summary.error}</div>
                      <div className="text-xs muted">Error</div>
                    </div>
                  </div>
                  <div className="rounded bg-gray-100 p-2 text-center">
                      <div className="text-gray-400">
                      <div className="font-bold text-lg">{(metrics?.noResponse || 0)}</div>
                      <div className="text-xs muted">Sin resp.</div>
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
              <div className="space-y-1 rounded border border-gray-200 bg-white p-2 results-list">
                {pagedResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="result-item text-xs font-mono"
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
