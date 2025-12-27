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
    console.log('[send-to-n8n] Received body:', body);

    const { webhookUrl, message, phone, name } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      console.log('[send-to-n8n] ERROR: webhookUrl missing or invalid:', webhookUrl);
      return NextResponse.json({ success: false, error: 'webhookUrl required' }, { status: 400 });
    }
    if (!message || typeof message !== 'string') {
      console.log('[send-to-n8n] ERROR: message missing or invalid:', message);
      return NextResponse.json({ success: false, error: 'message required' }, { status: 400 });
    }
    if (!phone || typeof phone !== 'string') {
      console.log('[send-to-n8n] ERROR: phone missing or invalid:', phone);
      return NextResponse.json({ success: false, error: 'phone required' }, { status: 400 });
    }
    if (!name || typeof name !== 'string') {
      console.log('[send-to-n8n] ERROR: name missing or invalid:', name);
      return NextResponse.json({ success: false, error: 'name required' }, { status: 400 });
    }

    console.log('[send-to-n8n] All params valid, formatting payload');
    const payload = formatWebhookPayload('text', message, phone, name);
    console.log('[send-to-n8n] Payload:', JSON.stringify(payload));

    console.log('[send-to-n8n] Sending to:', webhookUrl);
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    console.log('[send-to-n8n] Response status:', res.status);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.log('[send-to-n8n] Upstream error:', res.status, text);
      return NextResponse.json({ success: false, error: 'upstream error', status: res.status, body: text }, { status: 502 });
    }

    console.log('[send-to-n8n] SUCCESS');
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    console.log('[send-to-n8n] EXCEPTION:', message, err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
