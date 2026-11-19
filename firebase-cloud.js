// v106: opt-in guarded automatic sync; preserves v104 manual backup and restore.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,doc,getDoc,runTransaction,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const config={apiKey:'AIzaSyBZYn5k1OJzHA0JF7EF3deh0Wvcy6HGDL0',authDomain:'eyeshadow-diary.firebaseapp.com',projectId:'eyeshadow-diary',storageBucket:'eyeshadow-diary.firebasestorage.app',messagingSenderId:'401118755749',appId:'1:401118755749:web:6dcfd23352bca74bb3064c'};
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
let user=null,busy=false,cloudRevision=null,cloudExists=false,status='Not signed in · Local data stays on this device';
let auto=false,baseline=null,listener=null,flushTimer=null,flushing=false,conflict=false,remoteRevision=null;
const bridge=()=>window.diaryCloudBridge;
const snapshot=()=>bridge().getSnapshot();
const encode=s=>JSON.stringify({data:s.data,history:s.history,lastSave:s.lastSave??null});
const key=()=>`eyes_diary_auto_v105_${user.uid}`;
function ui(){const e=document.getElementById('cloud-status');if(e)e.textContent=status;for(const [id,enabled] of [['cloud-login',!user],['cloud-logout',!!user],['cloud-upload',!!user&&!auto],['cloud-download',!!user&&cloudExists&&!auto],['cloud-auto',!!user&&!auto&&cloudExists],['cloud-auto-stop',!!user&&auto]]){const b=document.getElementById(id);if(b)b.disabled=busy||!enabled;}}
window.refreshCloudUI=ui;
function ref(){if(!user)throw Error('Sign in first');return doc(db,'users',user.uid,'data','main');}
function count(s){return s.data.reduce((n,p)=>n+(p.type==='single'?1:(p.shades?.length||0)),0)}
function summary(s){return `${s.data.length} products, ${count(s)} shades, ${s.history.length} history entries`;}
function readSnapshot(d){if(!d||typeof d!=='object')throw Error('Cloud document is missing');const s=typeof d.snapshotJson==='string'?JSON.parse(d.snapshotJson):d.snapshot;if(!s||!Array.isArray(s.data)||!Array.isArray(s.history))throw Error('Invalid cloud backup');return s;}
function stopWatcher(){if(listener){listener();listener=null;}clearTimeout(flushTimer);flushTimer=null;}
function pause(message){auto=false;conflict=true;localStorage.removeItem(key());stopWatcher();status=`SYNC PAUSED · ${message} · Local data preserved`;ui();alert('Automatic sync paused: '+message+'\nNo local or cloud data was overwritten. Export a backup before resolving the conflict.');}
function setBaseline(rev,raw){baseline=raw;cloudRevision=rev;remoteRevision=rev;localStorage.setItem(key(),JSON.stringify({revision:rev,baseline:raw}));}
async function refresh(){if(!user)return;const s=await getDoc(ref());cloudExists=s.exists();cloudRevision=cloudExists?(s.data().revision||null):null;status=`${user.email} · ${cloudExists?'Cloud backup available':'Cloud empty — phone upload required'}`;ui();}
async function receive(s){if(!user||!auto)return;if(flushing){setTimeout(()=>{if(auto)receive(s).catch(e=>pause(e.message));},350);return;}if(!s.exists()){pause('Cloud backup was removed');return;}const d=s.data(),rev=d.revision||null;if(rev===remoteRevision)return;
 const raw=encode(readSnapshot(d));const local=encode(snapshot());
 if(local!==baseline){pause('Both device and cloud have changes');return;}
 if(raw!==local){try{bridge().applySnapshot(JSON.parse(raw));setBaseline(rev,raw);status=`${user.email} · Updated from cloud · Reloading`;ui();location.reload();}catch(e){pause('Cloud restore failed: '+e.message);}return;}
 setBaseline(rev,raw);status=`${user.email} · Auto sync up to date`;ui();}
function watch(){stopWatcher();listener=onSnapshot(ref(),s=>{receive(s).catch(e=>pause('Cloud update failed: '+e.message));},e=>pause('Cloud listener failed: '+e.message));}
function schedule(){if(!auto||!user||busy||conflict)return;clearTimeout(flushTimer);flushTimer=setTimeout(()=>flush().catch(e=>pause(e.message)),900);}
async function flush(){if(!auto||flushing||!user||busy)return;const local=encode(snapshot());if(local===baseline)return;flushing=true;try{
 const expected=cloudRevision;const rev=crypto.randomUUID();if(new Blob([local]).size>850000)throw Error('Backup exceeds Firestore document size');
 await runTransaction(db,async tx=>{const s=await tx.get(ref());if(!s.exists()||s.data().revision!==expected)throw Error('Cloud changed before this device uploaded');tx.set(ref(),{snapshotJson:local,revision:rev,updatedAt:new Date().toISOString(),schemaVersion:3,encoding:'json'});});
 // A second edit made during the network request remains pending and will be uploaded separately.
 setBaseline(rev,local);status=`${user.email} · Auto sync saved`;ui();
 }finally{flushing=false;if(auto&&encode(snapshot())!==baseline)schedule();}}
window.cloudAutoStart=async()=>{if(!user||busy||auto)return;busy=true;ui();try{
 const s=await getDoc(ref());if(!s.exists())throw Error('Cloud is empty. Use the verified phone manual upload first.');
 const remote=readSnapshot(s.data());const local=encode(snapshot()),raw=encode(remote);
 if(local!==raw)throw Error('Device and cloud data differ. Auto sync was NOT enabled. Export a backup and use Restore from cloud on the older device first.');
 if(!confirm(`Enable automatic two-way sync on this device?\n\n${summary(remote)}\n\nBoth copies match. Changes will upload automatically. If edits conflict, sync will pause instead of overwriting.`))return;
 conflict=false;auto=true;setBaseline(s.data().revision||null,raw);status=`${user.email} · Auto sync enabled`;watch();
 }catch(e){alert('Auto sync not enabled: '+e.message)}finally{busy=false;ui()}};
window.cloudAutoStop=()=>{if(!auto)return;auto=false;stopWatcher();localStorage.removeItem(key());status=`${user.email} · Auto sync off · Manual backup available`;ui()};
window.addEventListener('diary-local-change',()=>{if(auto)schedule()});
window.cloudSignIn=async()=>{busy=true;ui();try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){alert('Google sign-in failed: '+e.message)}finally{busy=false;ui()}};
window.cloudSignOut=async()=>{window.cloudAutoStop();await signOut(auth)};
onAuthStateChanged(auth,async u=>{stopWatcher();auto=false;baseline=null;user=u;cloudExists=false;cloudRevision=null;status=u?'Checking private cloud…':'Not signed in · Local data stays on this device';ui();if(u)try{await refresh();const stored=localStorage.getItem(key());if(stored){const prior=JSON.parse(stored);const local=encode(snapshot());if(prior.baseline===local&&prior.revision===cloudRevision){auto=true;baseline=local;remoteRevision=cloudRevision;status=`${u.email} · Auto sync enabled`;watch();}else{localStorage.removeItem(key());status=`${u.email} · Auto sync paused: verify device and cloud before enabling`;}}ui();}catch(e){status='Cloud check failed: '+e.message;ui()}});
window.cloudUpload=async()=>{if(!user||busy||auto)return;busy=true;ui();try{
 const local=snapshot(),remote=await getDoc(ref());if(remote.exists()&&remote.data().revision!==cloudRevision)throw Error('Cloud changed since last check. Reload before uploading.');
 const warning=remote.exists()?`Replace existing cloud data?\n\nLocal: ${summary(local)}\nCloud: ${summary(readSnapshot(remote.data()))}\n\nThis does not merge changes. Export a local JSON backup first.`:`FIRST CLOUD UPLOAD\n\nLocal: ${summary(local)}\n\nOnly upload from the PHONE that has your verified data.`;
 if(!confirm(warning))return;const expected=remote.exists()?remote.data().revision:null;const snapshotJson=encode(local);if(new Blob([snapshotJson]).size>850000)throw Error('Backup too large for one Firestore document');const revision=crypto.randomUUID();
 await runTransaction(db,async tx=>{const latest=await tx.get(ref());const actual=latest.exists()?latest.data().revision:null;if(actual!==expected)throw Error('Cloud changed during upload. Nothing overwritten.');tx.set(ref(),{snapshotJson,revision,updatedAt:new Date().toISOString(),schemaVersion:3,encoding:'json'});});
 cloudRevision=revision;cloudExists=true;status=`${user.email} · Cloud upload complete`;alert('Cloud upload complete. Your device data was not changed.');
 }catch(e){alert('Upload cancelled or failed: '+e.message)}finally{busy=false;ui()}};
window.cloudDownload=async()=>{if(!user||busy||auto)return;busy=true;ui();try{
 const remote=await getDoc(ref());if(!remote.exists())throw Error('Cloud backup not found');const incoming=readSnapshot(remote.data()),local=snapshot();
 if(!confirm(`RESTORE CLOUD TO THIS DEVICE?\n\nCloud: ${summary(incoming)}\nCurrent: ${summary(local)}\n\nThis REPLACES local data. A JSON backup will download first.`))return;
 bridge().downloadBackup();if(!confirm('Did your before-cloud-restore JSON backup download successfully? Cancel if not.'))return;
 bridge().applySnapshot(incoming);cloudRevision=remote.data().revision;cloudExists=true;status=`${user.email} · Cloud restored to this device`;alert('Cloud data restored. The app will reload.');location.reload();
 }catch(e){alert('Restore cancelled or failed: '+e.message)}finally{busy=false;ui()}};
