import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy,
  serverTimestamp 
} from "firebase/firestore";
import config from "../../firebase-applet-config.json";

// Initialize Firebase App
const app = !getApps().length ? initializeApp(config) : getApp();

// Initialize Firestore with configured databaseId
export const db = getFirestore(app, config.firestoreDatabaseId || undefined);

export {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp
};
