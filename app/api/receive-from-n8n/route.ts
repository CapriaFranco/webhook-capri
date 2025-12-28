import { NextRequest, NextResponse } from 'next/server';
import { getAdminDatabase } from '@/lib/firebase-admin';

type Inbound = {
  message: string;
  phone: string;
};

// store pending messages in-memory on the server
// { phone: [{ message, id, timestamp }] }
const globalKey = '__whatsapp_simulator_inbound_msgs';

function ensureStore() {
  // @ts-ignore
  if (!globalThis[globalKey]) globalThis[globalKey] = {} as Record<string, any[]>;
  // @ts-ignore
  return globalThis[globalKey] as Record<string, any[]>;
}

export async function POST(request: NextRequest) {
  try {
    let body: any = await request.json();
    console.log('[receive-from-n8n] ✅ RECIBIDO:', {
      timestamp: new Date().toISOString(),
      bodyType: typeof body,
      bodyKeys: typeof body === 'object' ? Object.keys(body) : 'N/A',
      bodyPreview: JSON.stringify(body).substring(0, 200),
    });
    console.log('[receive-from-n8n] Raw body completo:', JSON.stringify(body, null, 2));

    // Aggressive parsing: if it's a string, keep parsing until we can't anymore
    let depth = 0;
    while (typeof body === 'string' && depth < 5) {
      try {
        body = JSON.parse(body);
        depth++;
      } catch (e) {
        break;
      }
    }

    function normalize(b: any): Partial<Inbound> | null {
      if (!b) return null;

      // Case 1: already in expected shape {message, phone}
      if (typeof b === 'object' && !Array.isArray(b) && 'message' in b && 'phone' in b) {
        const msg = String(b.message || '').trim();
        const phn = String(b.phone || '').trim();
        if (msg && phn) return { message: msg, phone: phn };
      }

      // Case 2: WhatsApp-like array payload
      if (Array.isArray(b) && b.length > 0) {
        const first = b[0];
        if (typeof first === 'object') {
          const phone = String(first.to || first.from || first.recipient || '').trim();
          const message = String(first.text?.body || first.message || first.body || '').trim();
          if (message && phone) return { message, phone };
        }
      }

      // Case 3: Direct WhatsApp object (messaging_product, to, text.body)
      if (
        typeof b === 'object' &&
        !Array.isArray(b) &&
        ('messaging_product' in b || ('to' in b && 'text' in b))
      ) {
        const phone = String(b.to || b.from || '').trim();
        const message = String(b.text?.body || b.message || b.body || '').trim();
        if (message && phone) return { message, phone };
      }

      // Case 4: Object with numeric keys (n8n sometimes wraps this way)
      if (typeof b === 'object' && !Array.isArray(b)) {
        const keys = Object.keys(b);
        if (keys.length > 0) {
          const firstKey = keys[0];
          const maybeFirst = b[firstKey];
          if (typeof maybeFirst === 'object') {
            const phone = String(maybeFirst.to || maybeFirst.from || '').trim();
            const message = String(maybeFirst.text?.body || maybeFirst.message || maybeFirst.body || '').trim();
            if (message && phone) return { message, phone };
          }
        }
      }

      // Case 5: nested structure (data, messages, entry fields)
      if (typeof b === 'object' && !Array.isArray(b)) {
        const candidates = [b.data, b.messages, b.entry, b];
        for (const candidate of candidates) {
          if (Array.isArray(candidate) && candidate.length > 0) {
            const first = candidate[0];
            if (typeof first === 'object') {
              const phone = String(first.to || first.from || '').trim();
              const message = String(first.text?.body || first.message || first.body || '').trim();
              if (message && phone) return { message, phone };
            }
          }
        }
      }

      return null;
    }

    const normalized = normalize(body);
    console.log('[receive-from-n8n] Normalized:', normalized);

    if (!normalized || !normalized.message || !normalized.phone) {
      console.log('[receive-from-n8n] ERROR: Failed to extract message/phone from body');
      return NextResponse.json(
        { success: false, error: 'message and phone required', debug: { received: body } },
        { status: 400 }
      );
    }

    const { message, phone } = normalized as Inbound;

    // Guardar en Firebase Realtime Database
    try {
      const db = getAdminDatabase();
      const timestamp = new Date().toISOString();
      const receivedAt = Date.now(); // Timestamp en ms para calcular responseTime
      const messageData = {
        message,
        phone,
        timestamp,
        direction: 'inbound',
        receivedAt, // Timestamp en ms
      };

      const messagesRef = db.ref('messages');
      await messagesRef.push(messageData);
      console.log('[receive-from-n8n] ✅ GUARDADO EN FIREBASE:', { message, phone, timestamp, receivedAt });

      console.log('[receive-from-n8n] SUCCESS: Stored message for', phone);
      return NextResponse.json({ success: true });
    } catch (firebaseErr) {
      const errMsg = firebaseErr instanceof Error ? firebaseErr.message : 'firebase error';
      console.log('[receive-from-n8n] Firebase Error:', errMsg);
      return NextResponse.json(
        { success: false, error: 'Failed to save to database: ' + errMsg },
        { status: 500 }
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.log('[receive-from-n8n] EXCEPTION:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone');
    if (!phone) return NextResponse.json({ success: false, error: 'phone query required' }, { status: 400 });

    const db = getAdminDatabase();
    const snapshot = await db.ref('messages').orderByChild('phone').equalTo(phone).once('value');
    const data = snapshot.val() || {};

    const messages = Object.entries(data).map(([id, msg]: [string, any]) => ({
      id,
      ...msg,
    }));

    // Ordenar por timestamp descendente (más recientes primero)
    messages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ success: true, messages });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.log('[receive-from-n8n GET] Error:', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
