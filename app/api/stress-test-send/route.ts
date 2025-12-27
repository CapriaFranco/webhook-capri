import { NextRequest, NextResponse } from 'next/server';
import { getAdminDatabase } from '@/lib/firebase-admin';

type MessageUpdate = {
  message: string;
  phone: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
};

/**
 * Generar número de teléfono argentino formato: 54911XXXXXXXX (8 dígitos sin guiones)
 * Ejemplo: 5491112345678
 */
function generatePhoneNumber(): string {
  const digits = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join('');
  return `54911${digits}`;
}

/**
 * Generar nombre de usuario aleatorio
 */
function generateUserName(index: number): string {
  return `Usuario${index}`;
}

/**
 * Mensajes de ejemplo para usar en pruebas
 */
const sampleMessages = [
  'Hola! ¿Cómo estás?',
  'Probando el sistema',
  'Test de estrés en progreso',
  '¿Todo funciona bien?',
  'Mensaje de prueba número 1',
  'Mensaje de prueba número 2',
  'Sistema en ejecución',
  'Validando rendimiento',
  'Test completado',
  'Listo para producción',
];

/**
 * POST /api/stress-test-send
 * Envía mensajes reales al webhook de n8n y devuelve resultados detallados.
 */
export async function POST(req: NextRequest) {
  try {
    const startTime = Date.now();
    const { numUsers = 100, messagesPerUser = 1, webhookUrl } = await req.json();

    if (!webhookUrl) {
      return NextResponse.json({ error: 'webhookUrl es requerido' }, { status: 400 });
    }

    // Validaciones de límites (evitar sobrecarga extrema)
    const maxUsers = 10000000; // 10 millones como pidió
    const maxMsgs = 10;
    if (numUsers < 1 || numUsers > maxUsers) {
      return NextResponse.json({ error: `numUsers debe estar entre 1 y ${maxUsers}` }, { status: 400 });
    }
    if (messagesPerUser < 1 || messagesPerUser > maxMsgs) {
      return NextResponse.json({ error: `messagesPerUser debe estar entre 1 y ${maxMsgs}` }, { status: 400 });
    }

    const results = [];
    let totalSent = 0;
    let successCount = 0;
    let errorCount = 0;

    // Opcional: guardar en Firebase (para trazabilidad)
    const db = getAdminDatabase();
    const messagesRef = db.ref('messages');
    const updates: Record<string, MessageUpdate> = {};

    for (let u = 0; u < numUsers; u++) {
      const phone = generatePhoneNumber();
      const userName = generateUserName(u + 1);

      for (let m = 0; m < messagesPerUser; m++) {
        const message = sampleMessages[m % sampleMessages.length];
        const timestamp = new Date().toISOString();
        const payload = {
          message,
          phone,
          name: userName,
          timestamp,
        };

        // Guardar en Firebase antes de enviar (para que exista aunque falle el webhook)
        const newKey = messagesRef.push().key;
        if (newKey) {
          updates[`messages/${newKey}`] = {
            message,
            phone,
            timestamp,
            direction: 'outbound',
          };
        }

        const startReq = Date.now();
        try {
          const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const respText = await resp.text();
          const status = resp.ok ? 'success' : 'error';
          if (status === 'success') successCount++; else errorCount++;
          const waitTime = Date.now() - startReq;
          results.push({
            phone,
            userName,
            message,
            status,
            response: respText,
            timestamp,
            waitTime,
          });
        } catch (e) {
          errorCount++;
          const waitTime = Date.now() - startReq;
          results.push({
            phone,
            userName,
            message,
            status: 'error',
            response: e instanceof Error ? e.message : String(e),
            timestamp,
            waitTime,
          });
        }
        totalSent++;
      }
    }

    // Guardar en Firebase de una sola vez
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    return NextResponse.json({
      success: true,
      totalSent,
      successCount,
      errorCount,
      duration: Date.now() - startTime,
      results,
    });
  } catch (err) {
    console.error('[Stress Test Send] Error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
