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
    const body = (await request.json()) as Partial<Inbound>;
    const { message, phone } = body;
    if (!message || !phone) return NextResponse.json({ success: false, error: 'message and phone required' }, { status: 400 });

    const store = ensureStore();
    const item = { id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, message, phone, timestamp: new Date().toISOString() };
    if (!store[phone]) store[phone] = [];
    store[phone].push(item);

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
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
