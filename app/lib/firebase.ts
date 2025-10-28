import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { setLogLevel } from "firebase/app";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
// We add a check to see if the app is already initialized
// This is important for Next.js hot-reloading
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Set log level to debug for more detailed output in the console
setLogLevel('debug'); // Corrected from 'Debug'

// Get Firebase services
const db = getFirestore(app);
const auth = getAuth(app);

/**
 * Helper function to set up anonymous authentication
 * and get the user ID.
 */
const setupAuth = () => {
  return new Promise((resolve, reject) => {
    // onAuthStateChanged returns an unsubscribe function
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in.
        console.log('User is signed in:', user.uid);
        resolve(user.uid);
        unsubscribe(); // Stop listening after we have a user
      } else {
        // User is signed out. Try to sign in anonymously.
        console.log('User is signed out. Signing in anonymously...');
        signInAnonymously(auth).catch((error) => {
          console.error('Anonymous sign-in failed:', error);
          reject(error);
          unsubscribe(); // Stop listening on failure
        });
      }
    });
  });
};

export { db, auth, setupAuth, app };

