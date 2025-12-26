import { NextRequest, NextResponse } from 'next/server';
import { formatWebhookPayload, type MessageType } from '@/lib/webhook-formatter';

type SendWebhookBody = {
  webhookUrl: string;
  messageType: MessageType;
  content: string;
  from: string;
  contactName: string;
};

function isMessageType(value: unknown): value is MessageType {
  return value === 'text' || value === 'audio' || value === 'image';
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<SendWebhookBody>;
    const { webhookUrl, messageType, content, from, contactName } = body;

    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
    }
    if (!isMessageType(messageType)) {
      return NextResponse.json({ error: 'Invalid messageType' }, { status: 400 });
    }
    if (typeof from !== 'string' || !from) {
      return NextResponse.json({ error: 'from is required' }, { status: 400 });
    }
    if (typeof contactName !== 'string' || !contactName) {
      return NextResponse.json({ error: 'contactName is required' }, { status: 400 });
    }

    const payload = formatWebhookPayload(messageType, String(content ?? ''), from, contactName);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => '');
      return NextResponse.json(
        { error: `Webhook failed: ${response.status}`, responseBody },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook sent successfully',
      sentPayload: payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending webhook:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

