import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

let adminDb: ReturnType<typeof getDatabase> | null = null;

export function getAdminDatabase() {
  if (adminDb) return adminDb;

  // Inicializar admin SDK
  if (getApps().length === 0) {
    const serviceAccount = process.env.FIREBASE_ADMIN_SDK_JSON
      ? JSON.parse(process.env.FIREBASE_ADMIN_SDK_JSON)
      : null;

    if (!serviceAccount) {
      throw new Error(
        'FIREBASE_ADMIN_SDK_JSON env var not set. Get it from Firebase Console > Project Settings > Service Accounts > Generate private key'
      );
    }

    initializeApp({
      credential: cert(serviceAccount),
      databaseURL: `https://${serviceAccount.project_id}-default-rtdb.firebaseio.com`,
    });
  }

  adminDb = getDatabase();
  return adminDb;
}

export type Message = {
  id: string;
  message: string;
  phone: string;
  timestamp: string;
  direction: 'inbound' | 'outbound';
};
