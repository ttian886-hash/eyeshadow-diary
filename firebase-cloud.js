// v102: explicit, conflict-aware Firebase cloud transfer. No background writes.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,doc,getDoc,runTransaction} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const config={apiKey:'AIzaSyBZYn5k1OJzHA0JF7EF3deh0Wvcy6HGDL0',authDomain:'eyeshadow-diary.firebaseapp.com',projectId:'eyeshadow-diary',storageBucket:'eyeshadow-diary.firebasestorage.app',messagingSenderId:'401118755749',appId:'1:401118755749:web:6dcfd23352bca74bb3064c'};
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
let user=null,busy=false,cloudRevision=null,cloudExists=false,status='Not signed in · Local data stays on this device';
function ui(){const e=document.getElementById('cloud-status');if(e)e.textContent=status;for(const [id,enabled] of [['cloud-login',!user],['cloud-logout',!!user],['cloud-upload',!!user],['cloud-download',!!user&&cloudExists]]){const b=document.getElementById(id);if(b)b.disabled=busy||!enabled;}}
window.refreshCloudUI=ui;
function ref(){if(!user)throw Error('Sign in first');return doc(db,'users',user.uid,'data','main');}
function count(snapshot){return snapshot.data.reduce((n,p)=>n+(p.type==='single'?1:(p.shades?.length||0)),0)}
function summary(s){return `${s.data.length} products, ${count(s)} shades, ${s.history.length} history entries`;}
async function refresh(){if(!user)return;const snap=await getDoc(ref());cloudExists=snap.exists();cloudRevision=cloudExists?(snap.data().revision||null):null;status=`${user.email} · ${cloudExists?'Cloud backup available':'Cloud empty — phone upload required'}`;ui();}
window.cloudSignIn=async()=>{busy=true;ui();try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){alert('Google sign-in failed: '+e.message)}finally{busy=false;ui()}};
window.cloudSignOut=async()=>{await signOut(auth)};
onAuthStateChanged(auth,async u=>{user=u;cloudExists=false;cloudRevision=null;status=u?'Checking private cloud…':'Not signed in · Local data stays on this device';ui();if(u)try{await refresh()}catch(e){status='Cloud check failed: '+e.message;ui()}});
window.cloudUpload=async()=>{if(!user||busy)return;busy=true;ui();try{
 const local=window.diaryCloudBridge.getSnapshot();const remote=await getDoc(ref());
 if(remote.exists() && remote.data().revision!==cloudRevision)throw Error('Cloud changed since last check. Reload before uploading.');
 const warning=remote.exists()?`Replace existing cloud data?\n\nLocal: ${summary(local)}\nCloud: ${summary(remote.data().snapshot)}\n\nThis does not merge changes. Export a local JSON backup first.`:`FIRST CLOUD UPLOAD\n\nLocal: ${summary(local)}\n\nOnly upload from the PHONE that has your verified 5,107-use data. Do not upload the old computer copy.`;
 if(!confirm(warning))return;
 const expected=remote.exists()?remote.data().revision:null;
 const revision=crypto.randomUUID();
 await runTransaction(db,async tx=>{const latest=await tx.get(ref());const actual=latest.exists()?latest.data().revision:null;if(actual!==expected)throw Error('Cloud changed during upload. Nothing was overwritten.');tx.set(ref(),{snapshot:local,revision,updatedAt:new Date().toISOString(),schemaVersion:3});});
 cloudRevision=revision;cloudExists=true;status=`${user.email} · Cloud upload complete`;alert('Cloud upload complete. Your device data was not changed.');
 }catch(e){alert('Upload cancelled or failed: '+e.message)}finally{busy=false;ui()}};
window.cloudDownload=async()=>{if(!user||busy)return;busy=true;ui();try{
 const remote=await getDoc(ref());if(!remote.exists())throw Error('Cloud backup not found');const incoming=remote.data().snapshot;const local=window.diaryCloudBridge.getSnapshot();
 if(!confirm(`RESTORE CLOUD TO THIS DEVICE?\n\nCloud: ${summary(incoming)}\nCurrent: ${summary(local)}\n\nThis REPLACES the local data. A JSON backup will download first. Ensure the download is saved before proceeding.`))return;
 window.diaryCloudBridge.downloadBackup();
 if(!confirm('Did your before-cloud-restore JSON backup download successfully? Click Cancel if not.'))return;
 window.diaryCloudBridge.applySnapshot(incoming);cloudRevision=remote.data().revision;cloudExists=true;status=`${user.email} · Cloud restored to this device`;alert('Cloud data restored.');
 }catch(e){alert('Restore cancelled or failed: '+e.message)}finally{busy=false;ui()}};
