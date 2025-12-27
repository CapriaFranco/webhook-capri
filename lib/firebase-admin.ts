import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

let adminDb: ReturnType<typeof getDatabase> | null = null;

export function getAdminDatabase() {
  if (adminDb) return adminDb;

  // Inicializar admin SDK
  if (getApps().length === 0) {
    let serviceAccount: any = null;

    try {
      const jsonStr = process.env.FIREBASE_ADMIN_SDK_JSON;
      if (!jsonStr) {
        throw new Error('FIREBASE_ADMIN_SDK_JSON env var not set');
      }

      serviceAccount = JSON.parse(jsonStr);
    } catch (parseErr) {
      const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
      console.error('[firebase-admin] Failed to parse FIREBASE_ADMIN_SDK_JSON:', msg);
      throw new Error(
        `Failed to parse Firebase admin credentials: ${msg}. Make sure FIREBASE_ADMIN_SDK_JSON is valid JSON.`
      );
    }

    console.log('[firebase-admin] Successfully parsed credentials for:', serviceAccount?.project_id);

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
