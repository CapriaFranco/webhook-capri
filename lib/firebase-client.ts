import { initializeApp, getApps } from 'firebase/app';
import { getDatabase, ref, push, set, onValue, off, get } from 'firebase/database';
import type { Database, DatabaseReference, Unsubscribe } from 'firebase/database';

let clientDb: Database | null = null;

export function getClientDatabase() {
  if (clientDb) return clientDb;

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    databaseURL: `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`,
  };

  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }

  clientDb = getDatabase();
  return clientDb;
}

export type Message = {
  id?: string;
  message: string;
  phone: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
};

/**
 * Guardar un mensaje en Firebase Realtime Database
 * Path: /messages/{timestamp}_{random}
 */
export async function saveMessage(msg: Omit<Message, 'id'>) {
  const db = getClientDatabase();
  const messagesRef = ref(db, 'messages');
  const newMsgRef = push(messagesRef);
  await set(newMsgRef, msg);
  return newMsgRef.key;
}

/**
 * Obtener todos los mensajes (listener en tiempo real)
 */
export function subscribeToMessages(
  callback: (messages: Message[]) => void
): Unsubscribe {
  const db = getClientDatabase();
  const messagesRef = ref(db, 'messages');

  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    const msgs: Message[] = [];
    if (data) {
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        msgs.push({ id: key, ...value });
      });
    }
    // Ordenar por timestamp ASCENDENTE (nuevos abajo, como chat normal)
    msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    callback(msgs);
  });

  return unsubscribe;
}

/**
 * Filtrar mensajes por rango de fechas
 */
export function filterMessagesByDateRange(
  messages: Message[],
  startDate: Date | null,
  endDate: Date | null
): Message[] {
  if (!startDate && !endDate) return messages;

  return messages.filter((msg) => {
    const msgDate = new Date(msg.timestamp);
    if (startDate && msgDate < startDate) return false;
    if (endDate && msgDate > endDate) return false;
    return true;
  });
}

/**
 * Limpiar todos los mensajes de la base de datos
 */
export async function clearAllMessages(): Promise<void> {
  const db = getClientDatabase();
  const messagesRef = ref(db, 'messages');
  await set(messagesRef, null);
}

/**
 * Limpiar mensajes de un número específico
 */
export async function clearPhoneMessages(phone: string): Promise<void> {
  const db = getClientDatabase();
  const messagesRef = ref(db, 'messages');
  const snapshot = await get(messagesRef);
  const data = snapshot.val();

  if (data) {
    const deletePromises = Object.entries(data).map(([key, value]: [string, any]) => {
      if (value.phone === phone) {
        return set(ref(db, `messages/${key}`), null);
      }
      return Promise.resolve();
    });
    await Promise.all(deletePromises);
  }
}

/**
 * Obtener mensajes de un número específico
 */
export function subscribeToPhoneMessages(
  phone: string,
  callback: (messages: Message[]) => void
): Unsubscribe {
  const db = getClientDatabase();
  const messagesRef = ref(db, 'messages');

  const unsubscribe = onValue(messagesRef, (snapshot) => {
    const data = snapshot.val();
    const msgs: Message[] = [];
    if (data) {
      Object.entries(data).forEach(([key, value]: [string, any]) => {
        if (value.phone === phone) {
          msgs.push({ id: key, ...value });
        }
      });
    }
    // Ordenar por timestamp ASCENDENTE (nuevos abajo, como chat normal)
    msgs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    callback(msgs);
  });

  return unsubscribe;
}

/**
 * Desuscribirse de listener
 */
export function unsubscribeFromMessages(unsubscribe: Unsubscribe) {
  unsubscribe();
}
