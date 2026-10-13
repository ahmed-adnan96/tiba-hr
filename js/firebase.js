import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, doc, collection, setDoc, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

/* >>> الصق هنا إعدادات مشروعك من Firebase Console (Project settings > Your apps > Web) <<< */
const firebaseConfig = {
  apiKey: "AIzaSyDwLML8PiYbPA53f9cTW3NvWIotZaKKXB4",
  authDomain: "teba-hr.firebaseapp.com",
  projectId: "teba-hr",
  appId: "1:1056483789032:web:e05e4abe645aad18c7615d"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = getFirestore(app);

const wrapErr = e => { const x = new Error(e.message); x.code = e.code === 'permission-denied' ? 'revoked' : e.code; return x; };
const adapter = {
  doc: path => ({
    set: async obj => { try { await setDoc(doc(fs, path), obj); } catch (e) { throw wrapErr(e); } },
    delete: async () => { try { await deleteDoc(doc(fs, path)); } catch (e) { throw wrapErr(e); } }
  }),
  collection: name => ({
    onSnapshot: (ok, bad) => onSnapshot(collection(fs, name), { includeMetadataChanges: true }, ok, bad)
  })
};
window.claude = { use: async k => (k === 'db' ? adapter : null) };
window.__logout = () => { try { localStorage.removeItem('teba_hr_v1'); localStorage.removeItem('teba_hr_mig'); } catch (e) {} signOut(auth).then(() => location.reload()); };

const L = document.getElementById('login'), err = document.getElementById('lg_err');
document.getElementById('loginForm').addEventListener('submit', async ev => {
  ev.preventDefault(); err.textContent = '';
  try { await signInWithEmailAndPassword(auth, lg_email.value.trim(), lg_pass.value); }
  catch (e) { err.textContent = 'البريد أو كلمة المرور غير صحيحة.'; }
});
let booted = false;
onAuthStateChanged(auth, u => {
  if (u) { L.style.display = 'none'; if (!booted) { booted = true; window.__boot && window.__boot(); } }
  else { L.style.display = 'flex'; }
});
