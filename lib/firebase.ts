import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA2fvOwEKwkeS9AlDNDCELvtyCx07dE6xM',
  authDomain: 'chamcongtram.firebaseapp.com',
  projectId: 'chamcongtram',
  storageBucket: 'chamcongtram.firebasestorage.app',
  messagingSenderId: '476583007511',
  appId: '1:476583007511:web:e374fbbef8fcd541ce1352',
  measurementId: 'G-QHWJJWMZR3',
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);

let dbInstance;
try {
  dbInstance = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch {
  dbInstance = getFirestore(app);
}
export const db = dbInstance;
export default app;
