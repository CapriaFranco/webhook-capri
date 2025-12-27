import { getAdminDatabase } from '@/lib/firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Generar número de teléfono aleatorio formato: 11XX XXX XXXX
 */
function generatePhoneNumber(): string {
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  return `11${digits}`;
}

type UserResult = {
  phone: string;
  status: 'success' | 'error';
  message: string;
};

/**
 * POST /api/stress-test
 * Crea múltiples usuarios y mensajes para pruebas de estrés
 */
export async function POST(req: NextRequest) {
  try {
    const { numUsers = 100, messagesPerUser = 1 } = await req.json();

    // Validar límites
    if (numUsers < 1 || numUsers > 10000000) {
      return NextResponse.json(
        { error: 'numUsers debe estar entre 1 y 10.000.000' },
        { status: 400 }
      );
    }
    if (messagesPerUser < 1 || messagesPerUser > 10) {
      return NextResponse.json(
        { error: 'messagesPerUser debe estar entre 1 y 10' },
        { status: 400 }
      );
    }

    const db = getAdminDatabase();
    const messagesRef = db.ref('messages');

    // Mensajes de ejemplo
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

    const updates: Record<string, any> = {};
    const users: UserResult[] = [];
    let totalMessages = 0;

    // Generar usuarios y sus mensajes
    for (let u = 0; u < numUsers; u++) {
      const phone = generatePhoneNumber();
      let userSuccess = true;

      try {
        for (let m = 0; m < messagesPerUser; m++) {
          const messageKey = messagesRef.push().key;
          if (!messageKey) {
            userSuccess = false;
            break;
          }

          const now = new Date();
          const timestamp = new Date(
            now.getTime() - (messagesPerUser - m) * 60000
          ).toISOString();

          updates[`messages/${messageKey}`] = {
            message: sampleMessages[m % sampleMessages.length],
            phone,
            timestamp,
            direction: m % 2 === 0 ? 'inbound' : 'outbound',
          };

          totalMessages++;
        }

        users.push({
          phone,
          status: userSuccess ? 'success' : 'error',
          message: userSuccess ? 'Ok' : 'Error al generar mensaje',
        });
      } catch (err) {
        users.push({
          phone,
          status: 'error',
          message: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    // Guardar todo de una sola vez
    if (totalMessages > 0) {
      await db.ref().update(updates);
    }

    const successCount = users.filter((u) => u.status === 'success').length;
    console.log(
      `[Stress Test] Creados ${totalMessages} mensajes para ${successCount}/${numUsers} usuarios`
    );

    return NextResponse.json({
      success: true,
      totalMessages,
      numUsers: successCount,
      messagesPerUser,
      users: users.slice(0, 100), // Enviar solo los primeros 100 para no saturar respuesta
      message: `${totalMessages} mensajes creados exitosamente en ${successCount} usuarios`,
    });
  } catch (error) {
    console.error('[Stress Test Error]', error);
    return NextResponse.json(
      {
        error: `Error en la prueba de estrés: ${error instanceof Error ? error.message : 'Unknown error'}`,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/stress-test
 * Retorna información de la prueba de estrés
 */
export async function GET() {
  return NextResponse.json({
    name: 'Stress Test API',
    version: '2.0',
    method: 'POST',
    parameters: {
      numUsers: {
        type: 'number',
        min: 1,
        max: 10000000,
        default: 100,
        description: 'Número de usuarios a crear (lo más importante)',
      },
      messagesPerUser: {
        type: 'number',
        min: 1,
        max: 10,
        default: 1,
        description: 'Mensajes a crear por usuario',
      },
    },
    example: {
      request: {
        numUsers: 100,
        messagesPerUser: 1,
      },
      response: {
        success: true,
        totalMessages: 100,
        numUsers: 100,
        messagesPerUser: 1,
        users: [
          { phone: '1192345678', status: 'success', message: 'Ok' },
          { phone: '1187654321', status: 'success', message: 'Ok' },
        ],
      },
    },
  });
}
