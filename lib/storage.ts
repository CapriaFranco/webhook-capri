export const CONFIG_KEY = 'whatsapp-config';
export const MESSAGES_KEY = 'chat-messages';

export type StoredConfig = {
  webhookUrl: string;
  phone: string;
  name: string;
};

export type StoredMessage = {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  timestamp: string; // ISO
  status: 'sending' | 'sent' | 'error';
};

export function saveConfig(cfg: StoredConfig) {
  try {
    sessionStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    window.dispatchEvent(new Event('whatsapp-config-updated'));
  } catch {}
}

export function loadConfig(): StoredConfig | null {
  try {
    const raw = sessionStorage.getItem(CONFIG_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredConfig;
  } catch {
    return null;
  }
}

export function getMessages(): StoredMessage[] {
  try {
    const raw = sessionStorage.getItem(MESSAGES_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredMessage[];
  } catch {
    return [];
  }
}

export function saveMessages(msgs: StoredMessage[]) {
  try {
    sessionStorage.setItem(MESSAGES_KEY, JSON.stringify(msgs));
  } catch {}
}

export function pushMessage(msg: StoredMessage) {
  const all = getMessages();
  all.push(msg);
  saveMessages(all);
}

export function clearMessages() {
  sessionStorage.removeItem(MESSAGES_KEY);
}
