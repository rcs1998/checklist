// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// INSTRUÇÕES:
// Substitua os valores abaixo pelas credenciais do seu projeto.
// Acesse: https://console.firebase.google.com/
// Projeto → Configurações → Seus apps → SDK de configuração
//
// REGRAS DO FIRESTORE (cole em Firestore → Regras):
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /placas/{doc} {
//       allow read: if true;
//       allow write: if request.auth != null;
//     }
//     match /checklists/{doc} {
//       allow read: if request.auth != null;
//       allow create: if true;
//       allow update, delete: if request.auth != null;
//     }
//     match /itens/{doc} {
//       allow read: if true;
//       allow write: if request.auth != null;
//     }
//     match /secoes/{doc} {
//       allow read: if true;
//       allow write: if request.auth != null;
//     }
//   }
// }
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCdoK1l5S9JcNUtF6jBpXvEWSvp4TtshAk",
  authDomain: "checklistveiculos-8bc0c.firebaseapp.com",
  projectId: "checklistveiculos-8bc0c",
  storageBucket: "checklistveiculos-8bc0c.firebasestorage.app",
  messagingSenderId: "96243176239",
  appId: "1:96243176239:web:5afc0e6b6c2ac42ee1c7da"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
