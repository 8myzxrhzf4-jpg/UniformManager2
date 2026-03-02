import { initializeApp } from 'firebase/app';
import {
  getDatabase,
  ref as dbRef,
  get as dbGet,
  onValue,
  push as dbPush,	
  update as dbUpdate,
  set as dbSet,
} from 'firebase/database';
import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
} from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

async function restGet(path = '') {
  const base = firebaseConfig.databaseURL;
  if (!base) throw new Error('VITE_FIREBASE_DATABASE_URL is not set');
  const cleanBase = base.replace(/\/$/, '');
  const encodedPath = path
    ? path.replace(/^\//, '').split('/').map(segment => encodeURIComponent(segment)).join('/')
    : '';
  const url = encodedPath ? `${cleanBase}/${encodedPath}.json` : `${cleanBase}.json`;
  const res = await fetch(url, { mode: 'cors' });
  if (!res.ok) throw new Error(`REST GET failed: ${res.status} — ${url}`);
  return res.json();
}

// Extend Window so TypeScript knows about our custom properties
declare global {
  interface Window {
    __firebaseAdapter: unknown;
    __lastFetchedInventory?: unknown[];
  }
}

type SnapCallback = (snap: { val: () => unknown }) => void;

function makeRef(path = '') {
  const fullPath = path || '';
  return {
    path: fullPath,
    child(subPath: string) { return makeRef(fullPath ? `${fullPath}/${subPath}` : subPath); },
    async once(_event: string) {
      try {
        const snapshot = await dbGet(dbRef(db, fullPath));
        return { val: () => snapshot.val() };
      } catch {
        const data = await restGet(fullPath);
        return { val: () => data };
      }
    },
    on(event: string, callback: SnapCallback) {
      if (event !== 'value') return () => {};
      try {
        const unsub = onValue(dbRef(db, fullPath), snapshot => {
          try { callback({ val: () => snapshot.val() }); } catch(e) { console.error(e); }
        });
        if (typeof unsub === 'function') return unsub;
      } catch {}
      let stopped = false, last: string | null = null;
      const poll = async () => {
        if (stopped) return;
        try {
          const data = await restGet(fullPath);
          const s = JSON.stringify(data);
          if (s !== last) { last = s; try { callback({ val: () => data }); } catch(e) { console.error(e); } }
        } catch {}
      };
      poll();
      const id = setInterval(poll, 5000);
      return () => { stopped = true; clearInterval(id); };
    },
    off() {},
    push() {
      const pushed = dbPush(dbRef(db, fullPath));
      return { key: pushed.key, set: (value: unknown) => dbSet(pushed, value) };
    },
    async update(updates: Record<string, unknown>) { return dbUpdate(dbRef(db, fullPath), updates); },
    toString() { return `ref(${fullPath})`; },
  };
}

const adapter = {
  database() {
    return {
      ref(path: string = '') {
        const r = makeRef(path || '');
        if (!path) { r.update = (updates: Record<string, unknown>) => dbUpdate(dbRef(db, ''), updates); }
        return r;
      },
    };
  },
};

if (typeof window !== 'undefined') {
  window.__firebaseAdapter = {
    ref: (p: string) => makeRef(p || ''),
    restGet,
    _rawDb: db,
    _auth: auth,
    signIn: (email: string, password: string) => signInWithEmailAndPassword(auth, email, password),
    signOut: () => signOut(auth),
    currentUser: () => auth.currentUser,
  };
}

export default adapter;
