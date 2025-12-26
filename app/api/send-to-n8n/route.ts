import { NextRequest, NextResponse } from 'next/server';
import { formatWebhookPayload } from '@/lib/webhook-formatter';

type Body = {
  webhookUrl: string;
  message: string;
  phone: string;
  name: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<Body>;
    const { webhookUrl, message, phone, name } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string')
      return NextResponse.json({ success: false, error: 'webhookUrl required' }, { status: 400 });
    if (!message || typeof message !== 'string')
      return NextResponse.json({ success: false, error: 'message required' }, { status: 400 });
    if (!phone || typeof phone !== 'string')
      return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 });
    if (!name || typeof name !== 'string')
      return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });

    const payload = formatWebhookPayload('text', message, phone, name);

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ success: false, error: 'upstream error', status: res.status, body: text }, { status: 502 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
