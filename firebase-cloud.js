// v106: opt-in guarded automatic sync; preserves v104 manual backup and restore.
import {initializeApp} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {getAuth,GoogleAuthProvider,signInWithPopup,onAuthStateChanged,signOut} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import {getFirestore,doc,getDoc,runTransaction,onSnapshot} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
const config={apiKey:'AIzaSyBZYn5k1OJzHA0JF7EF3deh0Wvcy6HGDL0',authDomain:'eyeshadow-diary.firebaseapp.com',projectId:'eyeshadow-diary',storageBucket:'eyeshadow-diary.firebasestorage.app',messagingSenderId:'401118755749',appId:'1:401118755749:web:6dcfd23352bca74bb3064c'};
const app=initializeApp(config),auth=getAuth(app),db=getFirestore(app);
let user=null,busy=false,cloudRevision=null,cloudExists=false,status='Not signed in · Local data stays on this device';
let auto=false,baseline=null,listener=null,flushTimer=null,flushing=false,conflict=false,remoteRevision=null;
let lastCloudRaw=null;
let connectionEpoch=0,connectionTask=null,connectionRetryPending=false,connectionRetryTimer=null,connectionRetryCount=0;
const bridge=()=>window.diaryCloudBridge;
const snapshot=()=>bridge().getSnapshot();
const encode=s=>JSON.stringify({data:s.data,history:s.history,lastSave:s.lastSave??null});
const key=()=>`eyes_diary_auto_v105_${user.uid}`;
// v258: connection mode and a server-confirmed content match are distinct states.
let lastTransfer=null,serverConfirmedRaw=null,operationError=null;
function transferKey(uid=user?.uid){return 'eyes_diary_cloud_confirmation_v258_'+uid}
function readLastTransfer(uid){try{const v=JSON.parse(localStorage.getItem(transferKey(uid))||'null');return v&&['Uploaded to cloud','Received from cloud','Matched cloud'].includes(v.action)&&Number.isFinite(Date.parse(v.time))?{action:v.action,time:new Date(v.time)}:null}catch(error){return null}}
function markTransfer(action,raw){
 if(raw===serverConfirmedRaw&&lastTransfer&&action==='Matched cloud')return;
 serverConfirmedRaw=raw;operationError=null;lastTransfer={action,time:new Date()};
 try{localStorage.setItem(transferKey(),JSON.stringify({action,time:lastTransfer.time.toISOString()}))}catch(error){}
}
function cloudPresentation(s){
 if(s.offline)return {summary:'Offline · device data available',message:s.auto?'Your records are on this device. Automatic sync waits for a connection.':'Your records are on this device. Reconnect to check your cloud copy.',attention:true};
 if(!s.signedIn)return {summary:s.busy?'Connecting…':s.error?'Sign-in failed':'Sign in to sync',message:s.error?'Could not sign in. Try again when you are ready.':'Sign in to connect your devices. Your records stay on this device.',attention:!!s.error};
 if(s.conflict)return {summary:'Sync paused · review needed',message:(s.reason||'Automatic sync needs review.')+' Export a backup, then choose which copy to keep under Manual transfer.',attention:true};
 if(s.retry)return {summary:'Connection unavailable',message:'Your device records are preserved. Reconnect to the internet or retry the connection.',attention:true};
 if(s.busy)return {summary:'Syncing…',message:'Checking your records with the cloud…',attention:false};
 if(s.checking)return {summary:'Checking connection…',message:'Checking your private cloud copy…',attention:false};
 if(s.error)return {summary:'Sync needs attention',message:s.error,attention:true};
 if(s.auto){
  if(s.pending)return {summary:'Changes pending',message:'Saved on this device. Waiting for cloud confirmation.',attention:false};
  if(s.waiting||!s.matches)return {summary:'Checking sync…',message:'Waiting for a confirmed match with your cloud copy.',attention:false};
  return {summary:'Synced'+(s.time?' · '+s.time:''),message:'This device matches the latest confirmed cloud copy.',attention:false};
 }
 return {summary:s.exists?'Automatic sync off':'Cloud copy not set up',message:s.exists?'Your cloud copy is available. Turn on automatic sync to keep devices updated.':'Upload from the device with the records you want to keep, using Manual transfer below.',attention:false};
}
function syncPresentation(){
 const raw=user?encode(snapshot()):null;
 const reason=/Both device and cloud have changes/.test(status)?'Both copies have changes.':/need review/.test(status)?'Device and cloud records need review.':/Cloud backup was removed/.test(status)?'The cloud copy was removed.':/Cloud changed/.test(status)?'Cloud records changed before upload was confirmed.':/Cloud restore failed/.test(status)?'Cloud records could not be applied to this device.':'The cloud connection stopped before changes were confirmed.';
 return cloudPresentation({offline:typeof navigator!=='undefined'&&navigator.onLine===false,signedIn:!!user,busy:busy||flushing,auto,conflict,retry:connectionRetryPending,error:operationError,exists:cloudExists,checking:/Checking private cloud/.test(status),pending:auto&&raw!==baseline,matches:raw!==null&&raw===serverConfirmedRaw,waiting:/Waiting for cloud|Checking|Reloading/i.test(status),reason,time:lastTransfer?new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(lastTransfer.time):null});
}
function syncSummary(){return syncPresentation().summary}
function formatLastSyncTime(time,now=new Date()){
 return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',...(time.getFullYear()!==now.getFullYear()?{year:'numeric'}:{}),hour:'2-digit',minute:'2-digit'}).format(time);
}
function ui(){
 const put=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value},view=syncPresentation();
 put('cloud-status',view.message);document.getElementById('cloud-status')?.classList.toggle('cloud-attention',view.attention);put('cloud-compact-indicator',view.summary);
 put('cloud-account',user?.email||'Connect your devices with Google');
 put('cloud-last-transfer',lastTransfer?'Last synced · '+formatLastSyncTime(lastTransfer.time):'No confirmed sync yet');
 const toggle=document.getElementById('cloud-auto-toggle');if(toggle){toggle.checked=auto;toggle.disabled=busy||flushing||!user||(!auto&&!cloudExists);}
 for(const [id,enabled] of [['cloud-retry',!!user&&connectionRetryPending],['cloud-login',!user],['cloud-logout',!!user],['cloud-upload',!!user&&!auto],['cloud-download',!!user&&cloudExists&&!auto]]){const el=document.getElementById(id);if(el){el.disabled=busy||flushing||!enabled;if(['cloud-retry','cloud-login','cloud-logout'].includes(id))el.hidden=!enabled;}}
 put('cloud-manual-note',auto?'Turn off automatic sync before a manual transfer. Manual transfers replace data; they do not merge it.':'Manual transfers replace one copy with the other. Export a backup before choosing which copy to keep.');
}
window.refreshCloudUI=ui;
window.cloudToggleAuto=()=>auto?window.cloudAutoStop():window.cloudAutoStart();

function ref(){if(!user)throw Error('Sign in first');return doc(db,'users',user.uid,'data','main');}
function count(s){return s.data.reduce((n,p)=>n+(p.type==='single'?1:(p.shades?.length||0)),0)}
function summary(s){return `${s.data.length} products, ${count(s)} shades, ${s.history.length} history entries`;}
function readSnapshot(d){if(!d||typeof d!=='object')throw Error('Cloud document is missing');const s=typeof d.snapshotJson==='string'?JSON.parse(d.snapshotJson):d.snapshot;if(!s||!Array.isArray(s.data)||!Array.isArray(s.history))throw Error('Invalid cloud backup');return s;}
function stopWatcher(){if(listener){listener();listener=null;}clearTimeout(flushTimer);flushTimer=null;}
function pause(message){auto=false;conflict=true;localStorage.removeItem(key());stopWatcher();status=`SYNC PAUSED · ${message} · Local data preserved`;ui();alert('Automatic sync paused: '+message+'\nNo local or cloud data was overwritten. Export a backup before resolving the conflict.');}
function setBaseline(rev,raw){baseline=raw;cloudRevision=rev;remoteRevision=rev;localStorage.setItem(key(),JSON.stringify({revision:rev,baseline:raw}));}
async function refresh(epoch=connectionEpoch){
 if(!user)return false;const uid=user.uid,remote=ref(),s=await getDoc(remote);
 if(epoch!==connectionEpoch||user?.uid!==uid)return false;
 if(s.metadata?.fromCache)throw Error('Waiting for a live cloud connection');
 cloudExists=s.exists();cloudRevision=cloudExists?(s.data().revision||null):null;lastCloudRaw=cloudExists?encode(readSnapshot(s.data())):null;
 status=`${user.email} · ${cloudExists?'Cloud backup available':'Cloud copy not set up'}`;ui();return true;
}
function queueConnectionRetry(){
 clearTimeout(connectionRetryTimer);
 if(!connectionRetryPending||!user||conflict||connectionRetryCount>=6||typeof navigator!=='undefined'&&navigator.onLine===false)return;
 const delay=Math.min(30000,2000*2**connectionRetryCount++);
 connectionRetryTimer=setTimeout(()=>{connectionRetryTimer=null;checkCloudConnection();},delay);
}
function checkCloudConnection(){
 if(!user)return Promise.resolve();
 if(connectionTask?.epoch===connectionEpoch)return connectionTask.promise;
 const token={epoch:connectionEpoch};connectionTask=token;
 token.promise=(async()=>{
  try{
   if(!await refresh(token.epoch))return;
   if(token.epoch!==connectionEpoch)return;
   connectionRetryPending=false;connectionRetryCount=0;clearTimeout(connectionRetryTimer);
   const stored=localStorage.getItem(key());
   if(stored){
    const prior=JSON.parse(stored),local=encode(snapshot());
    if(cloudExists&&(prior.baseline===local||(cloudRevision===prior.revision&&lastCloudRaw===prior.baseline))){
     auto=true;baseline=prior.baseline;remoteRevision=prior.revision;status=`${user.email} · Auto sync enabled · Checking cloud updates`;watch();if(local!==baseline)schedule();
    }else{auto=false;conflict=true;localStorage.removeItem(key());status=`${user.email} · Auto sync paused: device and cloud need review`;}
   }
  }catch(e){
   if(token.epoch!==connectionEpoch)return;
   connectionRetryPending=true;status='Cloud connection unavailable · Device data preserved. Reconnect or retry.';queueConnectionRetry();
  }finally{if(connectionTask===token)connectionTask=null;if(token.epoch===connectionEpoch)ui();}
 })();return token.promise;
}
window.cloudRetryConnection=()=>{connectionRetryCount=0;return checkCloudConnection()};

async function receive(s){if(!user||!auto)return;if(flushing){setTimeout(()=>{if(auto)receive(s).catch(e=>pause(e.message));},350);return;}if(s.metadata?.fromCache||s.metadata?.hasPendingWrites){status=`${user.email} · Waiting for cloud confirmation`;ui();return;}if(!s.exists()){pause('Cloud backup was removed');return;}const d=s.data(),rev=d.revision||null;if(rev===remoteRevision){const confirmed=encode(readSnapshot(d));if(confirmed===encode(snapshot()))markTransfer('Matched cloud',confirmed);status=`${user.email} · Auto sync up to date`;ui();return;}
 const raw=encode(readSnapshot(d));const local=encode(snapshot());
 if(local!==baseline){pause('Both device and cloud have changes');return;}
 if(raw!==local){try{bridge().applySnapshot(JSON.parse(raw));setBaseline(rev,raw);markTransfer('Received from cloud',raw);status=`${user.email} · Updated from cloud · Reloading`;ui();location.reload();}catch(e){pause('Cloud restore failed: '+e.message);}return;}
 setBaseline(rev,raw);markTransfer('Matched cloud',raw);status=`${user.email} · Auto sync up to date`;ui();}
function watch(){stopWatcher();listener=onSnapshot(ref(),s=>{receive(s).catch(e=>pause('Cloud update failed: '+e.message));},e=>pause('Cloud listener failed: '+e.message));}
function schedule(){if(!auto||!user||busy||conflict)return;if(typeof navigator!=='undefined'&&navigator.onLine===false){ui();return;}ui();clearTimeout(flushTimer);flushTimer=setTimeout(()=>flush().catch(e=>pause(e.message)),900);}
async function flush(){if(!auto||flushing||!user||busy)return;if(typeof navigator!=='undefined'&&navigator.onLine===false){ui();return;}const local=encode(snapshot());if(local===baseline)return;flushing=true;try{
 const expected=cloudRevision;const rev=crypto.randomUUID();if(new Blob([local]).size>850000)throw Error('Backup exceeds Firestore document size');
 await runTransaction(db,async tx=>{const s=await tx.get(ref());if(!s.exists()||s.data().revision!==expected)throw Error('Cloud changed before this device uploaded');tx.set(ref(),{snapshotJson:local,revision:rev,updatedAt:new Date().toISOString(),schemaVersion:3,encoding:'json'});});
 // A second edit made during the network request remains pending and will be uploaded separately.
 setBaseline(rev,local);markTransfer('Uploaded to cloud',local);status=`${user.email} · Auto sync saved`;ui();
 }finally{flushing=false;ui();if(auto&&encode(snapshot())!==baseline)schedule();}}
window.cloudAutoStart=async()=>{if(!user||busy||auto)return;busy=true;operationError=null;ui();try{
 const s=await getDoc(ref());if(!s.exists())throw Error('No cloud copy exists yet. Upload from the device with the records you want to keep, using Manual transfer.');
 const remote=readSnapshot(s.data());const local=encode(snapshot()),raw=encode(remote);
 if(local!==raw)throw Error('Device and cloud records differ. Export a backup, then choose which copy to keep under Manual transfer. No copy was replaced.');
 if(!confirm(`Enable automatic two-way sync on this device?\n\n${summary(remote)}\n\nBoth copies match. Changes will upload automatically. If edits conflict, sync will pause instead of overwriting.`))return;
 conflict=false;auto=true;setBaseline(s.data().revision||null,raw);status=`${user.email} · Auto sync enabled`;watch();
 }catch(e){operationError='Automatic sync was not enabled. '+e.message}finally{busy=false;ui()}};
window.cloudAutoStop=()=>{if(!auto)return;auto=false;stopWatcher();localStorage.removeItem(key());operationError=null;status=`${user.email} · Auto sync off · Manual backup available`;ui()};
window.addEventListener('diary-local-change',()=>{if(auto)schedule()});
window.cloudSignIn=async()=>{busy=true;operationError=null;ui();try{await signInWithPopup(auth,new GoogleAuthProvider())}catch(e){operationError='Could not sign in. Please try again.'}finally{busy=false;ui()}};
window.cloudSignOut=async()=>{window.cloudAutoStop();await signOut(auth)};
onAuthStateChanged(auth,async u=>{
 connectionEpoch++;clearTimeout(connectionRetryTimer);connectionRetryPending=false;connectionRetryCount=0;
 stopWatcher();auto=false;baseline=null;conflict=false;user=u;lastTransfer=u?readLastTransfer(u.uid):null;serverConfirmedRaw=null;operationError=null;cloudExists=false;cloudRevision=null;lastCloudRaw=null;
 status=u?'Checking private cloud…':'Not signed in · Local data stays on this device';ui();if(u)await checkCloudConnection();
});
window.cloudUpload=async()=>{if(!user||busy||auto)return;busy=true;operationError=null;ui();try{
 const local=snapshot(),remote=await getDoc(ref());if(remote.exists()&&remote.data().revision!==cloudRevision)throw Error('Cloud changed since last check. Reload before uploading.');
 const warning=remote.exists()?`Replace existing cloud data?\n\nLocal: ${summary(local)}\nCloud: ${summary(readSnapshot(remote.data()))}\n\nThis does not merge changes. Export a local JSON backup first.`:`FIRST CLOUD UPLOAD\n\nLocal: ${summary(local)}\n\nUpload only from the device with the records you want to keep.`;
 if(!confirm(warning))return;const expected=remote.exists()?remote.data().revision:null;const snapshotJson=encode(local);if(new Blob([snapshotJson]).size>850000)throw Error('Backup too large for one Firestore document');const revision=crypto.randomUUID();
 await runTransaction(db,async tx=>{const latest=await tx.get(ref());const actual=latest.exists()?latest.data().revision:null;if(actual!==expected)throw Error('Cloud changed during upload. Nothing overwritten.');tx.set(ref(),{snapshotJson,revision,updatedAt:new Date().toISOString(),schemaVersion:3,encoding:'json'});});
 cloudRevision=revision;cloudExists=true;markTransfer('Uploaded to cloud',snapshotJson);status=`${user.email} · Cloud upload complete`;alert('Cloud upload complete. Your device data was not changed.');
 }catch(e){operationError='Cloud upload did not complete. '+e.message}finally{busy=false;ui()}};
window.cloudDownload=async()=>{if(!user||busy||auto)return;busy=true;operationError=null;ui();try{
 const remote=await getDoc(ref());if(!remote.exists())throw Error('Cloud backup not found');const incoming=readSnapshot(remote.data()),local=snapshot();
 if(!confirm(`RESTORE CLOUD TO THIS DEVICE?\n\nCloud: ${summary(incoming)}\nCurrent: ${summary(local)}\n\nThis REPLACES local data. A JSON backup will download first.`))return;
 bridge().downloadBackup();if(!confirm('Did your before-cloud-restore JSON backup download successfully? Cancel if not.'))return;
 bridge().applySnapshot(incoming);cloudRevision=remote.data().revision;cloudExists=true;if(!remote.metadata?.fromCache&&!remote.metadata?.hasPendingWrites)markTransfer('Received from cloud',encode(incoming));status=`${user.email} · Cloud restored to this device`;alert('Cloud data restored. The app will reload.');location.reload();
 }catch(e){operationError='Cloud restore did not complete. '+e.message}finally{busy=false;ui()}};

window.addEventListener('offline',ui);
window.addEventListener('online',()=>{connectionRetryCount=0;ui();if(auto)schedule();else if(connectionRetryPending)checkCloudConnection()});
document.addEventListener?.('visibilitychange',()=>{if(document.visibilityState==='visible'&&connectionRetryPending){connectionRetryCount=0;checkCloudConnection()}});
window.dispatchEvent(new Event('diary-cloud-ready'));
