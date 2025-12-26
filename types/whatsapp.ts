export type ChatMessage = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string; // ISO
  status: 'sending' | 'sent' | 'error';
};

export type Config = {
  webhookUrl: string;
  phone: string;
  name: string;
};
