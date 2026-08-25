import { auth, db } from './firebase';
import { 
  signInWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  User,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { getDoc, setDoc, updateDoc, doc } from 'firebase/firestore';

async function ensureUserDoc(user: User) {
  try {
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || 'Người dùng',
        email: user.email || '',
        avatarUrl: user.photoURL || null,
        createdAt: new Date().toISOString(),
        storeIds: [],
        currentStoreId: null,
      });
    } else {
      const data = snap.data();
      if (!data?.avatarUrl && user.photoURL) {
        await updateDoc(userRef, { avatarUrl: user.photoURL }).catch(() => {});
      }
    }
    return;
  } catch (err) {
    console.error('Lỗi khởi tạo tài liệu người dùng Firestore:', err);
  }
}


export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  const result = await signInWithPopup(auth, provider);
  if (result.user) {
    await ensureUserDoc(result.user);
  }
  return result;
}

export async function signInWithApple() {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  const result = await signInWithPopup(auth, provider);
  if (result.user) {
    await ensureUserDoc(result.user);
  }
  return result;
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthChanged(cb: (user: User | null) => void) {
  return onAuthStateChanged(auth, cb);
}

export async function getUserCurrentStoreId(uid: string): Promise<string | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.currentStoreId ?? null;
}

