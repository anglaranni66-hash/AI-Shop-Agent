import config from "../../firebase-applet-config.json";

export const firebaseConfig = {
  projectId: config.projectId,
  appId: config.appId,
  apiKey: config.apiKey,
  authDomain: config.authDomain,
  firestoreDatabaseId: config.firestoreDatabaseId,
  storageBucket: config.storageBucket,
  messagingSenderId: config.messagingSenderId,
  measurementId: config.measurementId,
  oAuthClientId: config.oAuthClientId,
  recaptchaSiteKey: config.recaptchaSiteKey,
};
