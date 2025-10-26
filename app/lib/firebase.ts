import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, setLogLevel } from "firebase/firestore";
import { getAuth, signInAnonymously, signInWithCustomToken } from "firebase/auth";

// Parse the Firebase config from the environment variable
const firebaseConfig = JSON.parse(
  process.env.NEXT_PUBLIC_FIREBASE_CONFIG || "{}"
);

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// Enable debug logging for Firestore
setLogLevel('debug');

// Function to get the current user ID
export const getUserId = () => {
  return auth.currentUser?.uid;
};

// Function to handle authentication
export const setupAuth = async () => {
  if (auth.currentUser) {
    return auth.currentUser.uid;
  }

  // Use __initial_auth_token if available (in production Canvas environment)
  if (typeof (window as any).__initial_auth_token !== 'undefined') {
    await signInWithCustomToken(auth, (window as any).__initial_auth_token);
  } else {
    // Fallback to anonymous sign-in for local development
    await signInAnonymously(auth);
  }
  return auth.currentUser?.uid;
};

export { db, auth, app };
