import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const rawText = await request.text();
    console.log('[DEBUG] Raw text body:', rawText);
    console.log('[DEBUG] Content-Type header:', request.headers.get('content-type'));

    let body: any;
    try {
      body = JSON.parse(rawText);
      console.log('[DEBUG] Parsed JSON:', JSON.stringify(body, null, 2));
    } catch (e) {
      console.log('[DEBUG] Failed to parse JSON:', e);
      body = rawText;
    }

    return NextResponse.json({
      success: true,
      debug: {
        rawText: rawText.substring(0, 500),
        contentType: request.headers.get('content-type'),
        parsedBody: body,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
