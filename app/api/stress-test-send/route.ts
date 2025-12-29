import { NextRequest, NextResponse } from 'next/server';
import { getAdminDatabase } from '@/lib/firebase-admin';

type MessageUpdate = {
  message: string;
  phone: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
  sentAt?: number; // Timestamp en ms cuando se envió (para calcular response time)
  receivedAt?: number; // Timestamp en ms cuando se recibió la respuesta
};

type TestResult = {
  phone: string;
  userName: string;
  message: string;
  status: string;
  response: string;
  n8nResponse?: string;
  timestamp: string;
  sentAt?: number; // Timestamp en ms cuando se envió
  waitTime: number;
  responseTime?: number; // Tiempo que tardó n8n en responder (desde que se envió)
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
 * Generar ID de mensaje realista (similar a wamid.XXX)
 */
function generateMessageId(): string {
  const random = Math.random().toString(36).substring(2, 15);
  return `wamid.${Date.now()}_${random}`;
}

/**
 * Generar nombre de usuario aleatorio
 */
function generateUserName(index: number): string {
  return `Usuario${index}`;
}

/**
 * Construir payload en formato WhatsApp API / 360dialog
 */
function buildWhatsAppPayload(phone: string, userName: string, message: string): Record<string, unknown> {
  const timestamp = Math.floor(Date.now() / 1000); // Timestamp en segundos como WhatsApp

  return {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1195530322139282',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: phone,
                phone_number_id: '895152937018567',
              },
              contacts: [
                {
                  profile: {
                    name: userName,
                  },
                  wa_id: phone,
                },
              ],
              messages: [
                {
                  from: phone,
                  id: generateMessageId(),
                  timestamp: timestamp.toString(),
                  type: 'text',
                  text: {
                    body: message,
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };
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
 * Envía mensajes reales al webhook de n8n y retorna inmediatamente.
 * El frontend escucha Firebase en tiempo real para actualizaciones de respuestas.
 */
export async function POST(req: NextRequest) {
  try {
    const startTime = Date.now();
    const { numUsers = 100, messagesPerUser = 1, intervalMs = 0, webhookUrl } = await req.json();

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

    const results: TestResult[] = [];
    let totalSent = 0;
    let errorCount = 0;

    // Opcional: guardar en Firebase (para trazabilidad)
    const db = getAdminDatabase();
    const messagesRef = db.ref('messages');
    const updates: Record<string, MessageUpdate> = {};
    
    // Track phones sent to match with responses from n8n
    const phonesSent = new Set<string>();
    // Mapa de phone -> datos del mensaje outbound (para calcular responseTime)
    const phoneOutboundData: Record<string, { sentAt: number }> = {};

    // Bucle reorganizado: primero todos los usuarios envían el mensaje 1, luego esperan intervalMs,
    // luego todos envían el mensaje 2, etc.
    for (let m = 0; m < messagesPerUser; m++) {
      for (let u = 0; u < numUsers; u++) {
        const phone = generatePhoneNumber();
        const userName = generateUserName(u + 1);
        phonesSent.add(phone); // Track para later matching de respuestas

        const message = sampleMessages[m % sampleMessages.length];
        const timestamp = new Date().toISOString();
        const sentAt = Date.now(); // Timestamp en ms del envío
        
        // Guardar info del outbound para calcular responseTime después
        phoneOutboundData[phone] = { sentAt };
        
        // Construir payload en formato WhatsApp API / 360dialog
        const payload = buildWhatsAppPayload(phone, userName, message);

        // Guardar en Firebase antes de enviar (para que exista aunque falle el webhook)
        const newKey = messagesRef.push().key;
        if (newKey) {
          updates[`messages/${newKey}`] = {
            message,
            phone,
            timestamp,
            direction: 'outbound',
            sentAt, // Guardar timestamp de envío
          };
        }

        const startReq = Date.now();
        try {
          const resp = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          
          // Verificar si la respuesta HTTP fue exitosa (2xx)
          if (!resp.ok) {
            errorCount++;
            results.push({
              phone,
              userName,
              message,
              status: 'error',
              response: `HTTP ${resp.status}: ${resp.statusText}`,
              timestamp,
              sentAt, // Incluir timestamp de envío
              waitTime: Date.now() - startReq,
            });
            console.log(`[stress-test] Error enviando a ${webhookUrl}: HTTP ${resp.status}`);
          } else {
            // Enviado correctamente, pendiente de respuesta del flujo
            results.push({
              phone,
              userName,
              message,
              status: 'pending',
              response: '',
              timestamp,
              sentAt, // Incluir timestamp de envío para calcular responseTime después
              waitTime: Date.now() - startReq,
            });
          }
        } catch (e) {
          errorCount++;
          results.push({
            phone,
            userName,
            message,
            status: 'error',
            response: e instanceof Error ? e.message : String(e),
            timestamp,
            sentAt, // Incluir timestamp de envío
            waitTime: Date.now() - startReq,
          });
          console.error(`[stress-test] Error de red/conexión al enviar a ${webhookUrl}: ${e instanceof Error ? e.message : String(e)}`);
        }
        totalSent++;
      }
      
      // Si hay intervalo y no es el último lote, esperar
      if (intervalMs > 0 && m < messagesPerUser - 1) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    // Guardar en Firebase de una sola vez
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    // Retornar inmediatamente sin esperar respuestas
    // El frontend escucha Firebase en tiempo real para actualizaciones
    console.log(`[stress-test] Enviados ${totalSent} mensajes. El frontend escuchará en tiempo real.`);

    return NextResponse.json({
      success: true,
      totalSent,
      successCount: 0, // Aún no hay respuestas
      errorCount,
      duration: Date.now() - startTime,
      metrics: {
        lessThan1s: 0,
        lessThan5s: 0,
        lessThan30s: 0,
        noResponse: totalSent - errorCount, // Inicialmente todos son "pendientes"
        errors: errorCount,
      },
      results, // Resultados con status 'pending' o 'error'
      note: 'Mensaje enviados. Las respuestas se actualizarán en tiempo real en el frontend.',
    });
  } catch (err) {
    console.error('[Stress Test Send] Error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
