import { NextRequest, NextResponse } from 'next/server';
import { getAdminDatabase } from '@/lib/firebase-admin';

type MessageUpdate = {
  message: string;
  phone: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
};

type TestResult = {
  phone: string;
  userName: string;
  message: string;
  status: string;
  response: string;
  n8nResponse?: string;
  timestamp: string;
  waitTime: number;
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
 * Envía mensajes reales al webhook de n8n y devuelve resultados detallados.
 */
export async function POST(req: NextRequest) {
  try {
    const startTime = Date.now();
    const { numUsers = 100, messagesPerUser = 1, webhookUrl, waitForResponses = true, waitMs = 3000 } = await req.json();

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
    let successCount = 0;
    let errorCount = 0;

    // Opcional: guardar en Firebase (para trazabilidad)
    const db = getAdminDatabase();
    const messagesRef = db.ref('messages');
    const updates: Record<string, MessageUpdate> = {};
    
    // Track phones sent to match with responses from n8n
    const phonesSent = new Set<string>();

    for (let u = 0; u < numUsers; u++) {
      const phone = generatePhoneNumber();
      const userName = generateUserName(u + 1);
      phonesSent.add(phone); // Track para later matching de respuestas

      for (let m = 0; m < messagesPerUser; m++) {
        const message = sampleMessages[m % sampleMessages.length];
        const timestamp = new Date().toISOString();
        
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
          const waitTime = Date.now() - startReq;
          
          // NO contar como éxito/error aquí - solo es confirmación de recepción
          // El status real se determinará después basado en respuesta del flujo
          results.push({
            phone,
            userName,
            message,
            status: 'pending', // Pendiente hasta que llegue respuesta real del flujo
            response: respText, // Mostrar respuesta HTTP inmediata pero no usar para contar
            timestamp,
            waitTime,
          });
        } catch (e) {
          const waitTime = Date.now() - startReq;
          // Error en envío del webhook mismo
          results.push({
            phone,
            userName,
            message,
            status: 'error',
            response: e instanceof Error ? e.message : String(e),
            timestamp,
            waitTime,
          });
          errorCount++;
        }
        totalSent++;
      }
    }

    // Guardar en Firebase de una sola vez
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    // Si solicitamos esperar respuestas, aguardar un tiempo y luego buscar respuestas en Firebase
    if (waitForResponses && waitMs > 0) {
      console.log(`[stress-test] Esperando ${waitMs}ms por respuestas de n8n...`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
      
      // Capturar mensajes inbound que llegaron en este tiempo (respuestas del flujo de n8n)
      const snapshot = await db.ref('messages').get();
      if (snapshot.exists()) {
        const allMessages = snapshot.val() as Record<string, MessageUpdate>;
        const inboundResponses: Record<string, MessageUpdate> = {};
        
        for (const [, msg] of Object.entries(allMessages)) {
          if (msg.direction === 'inbound' && phonesSent.has(msg.phone)) {
            inboundResponses[msg.phone] = msg;
          }
        }
        
        // Actualizar status y respuestas basado en lo que realmente devolvió n8n
        successCount = 0; // Reiniciar contador
        for (const result of results) {
          if (result.status === 'error') {
            // Ya era error en el envío mismo, no cambiar
            continue;
          }
          
          if (inboundResponses[result.phone]) {
            result.n8nResponse = inboundResponses[result.phone].message;
            // Determinar si fue éxito o error basado en el contenido de la respuesta
            const responseMsg = inboundResponses[result.phone].message.toLowerCase();
            if (responseMsg.includes('error') || responseMsg.includes('fail')) {
              result.status = 'error';
            } else {
              result.status = 'success';
              successCount++;
            }
            console.log(`[stress-test] Actualizado ${result.phone}: ${result.status} - ${inboundResponses[result.phone].message}`);
          } else {
            // No llegó respuesta del flujo después de esperar
            result.status = 'no_response';
            console.log(`[stress-test] Sin respuesta para ${result.phone} después de ${waitMs}ms`);
          }
        }
        
        errorCount = results.filter(r => r.status === 'error').length;
      }
    }

    return NextResponse.json({
      success: true,
      totalSent,
      successCount,
      errorCount,
      duration: Date.now() - startTime,
      results,
      note: waitForResponses ? `Esperó ${waitMs}ms por respuestas desde n8n` : 'Sin espera por respuestas',
    });
  } catch (err) {
    console.error('[Stress Test Send] Error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
