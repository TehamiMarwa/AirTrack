import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBi1J6B2kqEgtaBmGu6vXllD7ZsWDo7txI",
  authDomain: "airqualitymonitor-b71b0.firebaseapp.com",
  databaseURL: "https://airqualitymonitor-b71b0-default-rtdb.firebaseio.com",
  projectId: "airqualitymonitor-b71b0",
  storageBucket: "airqualitymonitor-b71b0.firebasestorage.app",
  messagingSenderId: "393408028164",
  appId: "1:393408028164:web:fcae74df02946f7ab11f51"
};


const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);