import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Placeholder Config - USER MUST REPLACE THESE
const firebaseConfig = {
    apiKey: "AIzaSyApxWd1zkk3hGm3raCJpbkDRR1O7simHjc",
    authDomain: "clinic-core-1910.firebaseapp.com",
    projectId: "clinic-core-1910",
    storageBucket: "clinic-core-1910.firebasestorage.app",
    messagingSenderId: "354339052204",
    appId: "1:354339052204:web:4d0db0738b8c96fef09d09",
    measurementId: "G-LPRG7R0NLX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

console.log("Firebase Initialized");
// Export
export { app, db, auth, collection, addDoc, getDocs, getDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, orderBy, serverTimestamp, setDoc, limit, signInWithEmailAndPassword, signOut, onAuthStateChanged };
