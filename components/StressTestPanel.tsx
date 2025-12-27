'use client';

import { useState } from 'react';

type UserResult = {
  phone: string;
  status: 'success' | 'error';
  message: string;
};

export default function StressTestPanel() {
  const [numUsers, setNumUsers] = useState(100);
  const [messagesPerUser, setMessagesPerUser] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<{
    status: 'success' | 'error';
    message: string;
    totalMessages: number;
    users: UserResult[];
    duration: number;
  } | null>(null);

  const handleRunTest = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const startTime = Date.now();
      const response = await fetch('/api/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          numUsers: Number(numUsers),
          messagesPerUser: Number(messagesPerUser),
        }),
      });

      const data = await response.json();
      const duration = Date.now() - startTime;

      if (response.ok) {
        setResult({
          status: 'success',
          message: `✅ ${data.totalMessages} mensajes creados exitosamente`,
          totalMessages: data.totalMessages,
          users: data.users || [],
          duration,
        });
      } else {
        setResult({
          status: 'error',
          message: `❌ Error: ${data.error}`,
          totalMessages: 0,
          users: [],
          duration,
        });
      }
    } catch (err) {
      setResult({
        status: 'error',
        message: `❌ Error: ${err instanceof Error ? err.message : 'Unknown error'}`,
        totalMessages: 0,
        users: [],
        duration: Date.now(),
      });
    } finally {
      setIsLoading(false);
    }
  };

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

  const totalMessages = numUsers * messagesPerUser;
  const successUsers = result?.users.filter((u) => u.status === 'success').length || 0;
  const errorUsers = result?.users.filter((u) => u.status === 'error').length || 0;

  return (
    <div className="rounded-lg border border-orange-300 bg-orange-50 p-6">
      <h3 className="mb-4 text-lg font-semibold text-orange-900">🧪 Prueba de Estrés</h3>

      <div className="space-y-4">
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
          <div className="text-sm text-gray-700">Total de mensajes a crear:</div>
          <div className="text-2xl font-bold text-orange-600">{totalMessages.toLocaleString()}</div>
        </div>

        {/* Botón */}
        <button
          onClick={handleRunTest}
          disabled={isLoading}
          className="w-full rounded bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? 'Ejecutando prueba...' : '▶️ Ejecutar Prueba'}
        </button>

        {/* Resultado */}
        {result && (
          <div
            className={`rounded-lg border p-4 ${
              result.status === 'success'
                ? 'border-green-300 bg-green-50 text-green-800'
                : 'border-red-300 bg-red-50 text-red-800'
            }`}
          >
            <div className="font-medium">{result.message}</div>
            {result.totalMessages > 0 && (
              <div className="mt-3 space-y-2 text-sm">
                <div>📊 {result.totalMessages.toLocaleString()} mensajes guardados</div>
                <div>⏱️ Duración: {result.duration}ms ({(result.duration / 1000).toFixed(2)}s)</div>
                <div>
                  ⚡ Velocidad: {((result.totalMessages / (result.duration / 1000)).toFixed(0).toLocaleString())}
                  {' '}
                  msgs/s
                </div>

                {/* Resumen de usuarios */}
                {result.users.length > 0 && (
                  <div className="mt-4 border-t pt-3">
                    <div className="font-semibold">
                      Estados de usuarios: ✅ {successUsers} / ❌ {errorUsers}
                    </div>

                    {/* Lista de usuarios */}
                    <div className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded bg-white p-2 text-xs">
                      {result.users.slice(0, 50).map((user, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-gray-700">
                          <span className={`inline-block h-2 w-2 rounded-full ${user.status === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></span>
                          <span className="font-mono">{user.phone}</span>
                        </div>
                      ))}
                      {result.users.length > 50 && (
                        <div className="pt-2 text-center text-gray-500">
                          ... y {result.users.length - 50} usuarios más
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Info */}
        <div className="rounded bg-blue-50 p-3 text-xs text-blue-800">
          <strong>💡 Info:</strong> Crea múltiples números de teléfono (11XX XXX XXXX) con sus respectivos
          mensajes. Máximo 10M usuarios, 10 msgs c/u. Default: 100 usuarios, 1 mensaje.
        </div>
      </div>
    </div>
  );
}
