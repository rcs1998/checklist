// ============================================================
// CONFIGURAÇÃO DO FIREBASE
// ============================================================
// INSTRUÇÕES DE CONFIGURAÇÃO:
// 1. Acesse https://console.firebase.google.com/
// 2. Clique em "Adicionar projeto" e siga os passos
// 3. No projeto criado, clique em "Adicionar app" > ícone Web (</>)
// 4. Registre o app e copie as credenciais abaixo
// 5. Em "Authentication" > "Sign-in method" > ative "E-mail/senha"
// 6. Em "Firestore Database" > "Criar banco de dados" > modo produção
// 7. Em "Firestore Database" > "Regras" cole as regras abaixo:
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
//     match /config/{doc} {
//       allow read: if request.auth != null;
//       allow write: if request.auth != null;
//     }
//   }
// }
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyCdoK1l5S9JcNUtF6jBpXvEWSvp4TtshAk",
  authDomain: "checklistveiculos-8bc0c.firebaseapp.com",
  projectId: "checklistveiculos-8bc0c",
  storageBucket: "checklistveiculos-8bc0c.firebasestorage.app",
  messagingSenderId: "96243176239",
  appId: "1:96243176239:web:5afc0e6b6c2ac42ee1c7da"
};

// Importações via CDN (usadas nos HTML files via type="module")
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
