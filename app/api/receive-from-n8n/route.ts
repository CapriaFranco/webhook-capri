import { NextRequest, NextResponse } from 'next/server';

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
    console.log('[receive-from-n8n] Raw body:', JSON.stringify(body, null, 2));

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

    const store = ensureStore();
    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      message,
      phone,
      timestamp: new Date().toISOString(),
    };
    if (!store[phone]) store[phone] = [];
    store[phone].push(item);

    console.log('[receive-from-n8n] SUCCESS: Stored message for', phone);
    return NextResponse.json({ success: true });
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

    const store = ensureStore();
    const msgs = store[phone] ?? [];
    // return messages and clear them
    store[phone] = [];

    return NextResponse.json({ success: true, messages: msgs });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
