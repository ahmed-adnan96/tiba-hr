import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
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

window.__changePassword = async (currentPass, newPass) => {
  const u = auth.currentUser;
  if (!u || !u.email) throw new Error('not-signed-in');
  const cred = EmailAuthProvider.credential(u.email, currentPass);
  await reauthenticateWithCredential(u, cred);
  await updatePassword(u, newPass);
};

const boot = document.getElementById('boot');
const L = document.getElementById('login'), err = document.getElementById('lg_err'), ok = document.getElementById('lg_ok');
const hideBoot = () => { if (boot) { boot.classList.add('hide'); setTimeout(() => boot.remove(), 400); } };

document.getElementById('loginForm').addEventListener('submit', async ev => {
  ev.preventDefault(); err.textContent = ''; if (ok) ok.textContent = '';
  try { await signInWithEmailAndPassword(auth, lg_email.value.trim(), lg_pass.value); }
  catch (e) { err.textContent = 'البريد أو كلمة المرور غير صحيحة.'; }
});

document.getElementById('lg_forgot').addEventListener('click', async () => {
  err.textContent = ''; if (ok) ok.textContent = '';
  const email = (lg_email.value || '').trim();
  if (!email) { err.textContent = 'اكتب البريد الإلكتروني أولاً ثم اضغط نسيت كلمة المرور.'; return; }
  try {
    await sendPasswordResetEmail(auth, email);
    if (ok) ok.textContent = 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك. افحص الوارد (والرسائل غير المرغوب فيها).';
  } catch (e) {
    const c = e && e.code;
    if (c === 'auth/user-not-found') err.textContent = 'لا يوجد حساب بهذا البريد.';
    else if (c === 'auth/invalid-email') err.textContent = 'صيغة البريد غير صحيحة.';
    else if (c === 'auth/too-many-requests') err.textContent = 'محاولات كثيرة، حاول بعد قليل.';
    else err.textContent = 'تعذّر إرسال الرابط. تأكد من البريد وحاول مرة أخرى.';
  }
});

let booted = false;
onAuthStateChanged(auth, u => {
  if (u) {
    L.style.display = 'none';
    hideBoot();
    if (!booted) { booted = true; window.__boot && window.__boot(); }
  } else {
    hideBoot();
    L.style.display = 'flex';
  }
});
