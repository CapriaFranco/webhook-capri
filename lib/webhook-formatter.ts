export type MessageType = 'text' | 'audio' | 'image';

export function generateRandomId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function formatWebhookPayload(
  messageType: MessageType,
  content: string,
  from: string,
  contactName: string
) {
  const basePayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '1195530322139282',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '5491165333359',
                phone_number_id: '895152937018567',
              },
              contacts: [
                {
                  profile: {
                    name: contactName,
                  },
                  wa_id: from,
                },
              ],
              messages: [] as any[],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const messageId = `wamid.${generateRandomId()}`;

  const message: any = {
    from,
    id: messageId,
    timestamp,
    type: messageType,
  };

  switch (messageType) {
    case 'text':
      message.text = { body: content };
      break;
    case 'audio':
      message.audio = {
        mime_type: 'audio/ogg; codecs=opus',
        sha256: 'KvlGNV3fCuluyzgD/SFHbBIeKTd8RaMEX5MAztZN6L8=',
        id: generateRandomId(),
        url: 'https://example.com/audio.ogg',
        voice: true,
      };
      break;
    case 'image':
      message.image = {
        mime_type: 'image/jpeg',
        sha256: 'abc123==',
        id: generateRandomId(),
        url: content || 'https://example.com/image.jpg',
      };
      break;
  }

  basePayload.entry[0].changes[0].value.messages.push(message);
  return basePayload;
}

