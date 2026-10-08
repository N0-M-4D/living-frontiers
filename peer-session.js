(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PeerSession=api;})(globalThis,function(){
 'use strict';
 const VERSION=1,MAX_SIGNAL=32768,MAX_SNAPSHOT=1024*1024,CHUNK=8000;
 const fail=message=>{throw Error(message);};
 function parseJSON(text){return JSON.parse(text,(key,value)=>['__proto__','prototype','constructor'].includes(key)?fail('Invalid message field.'):value);}
 function packSignal(description,id){return 'LF1.'+btoa(JSON.stringify({v:VERSION,id,type:description.type,sdp:description.sdp}));}
 function readSignal(text,type,id){
  if(typeof text!=='string'||text.length>MAX_SIGNAL)fail('That connection text is too large. Ask for a new invite.');
  let value;try{if(!text.trim().startsWith('LF1.'))throw Error();value=parseJSON(atob(text.trim().slice(4)));}catch{fail('Paste the complete Living Frontiers invite or reply.');}
  if(value.v!==VERSION||value.type!==type||typeof value.id!=='string'||!/^[a-f0-9]{32}$/.test(value.id)||typeof value.sdp!=='string'||value.sdp.length>20000||!value.sdp.startsWith('v=0')||(id&&value.id!==id))fail('This invite or reply belongs to a different connection.');
  if(!/^m=application /m.test(value.sdp)||/^m=(audio|video) /m.test(value.sdp))fail('This is not a game connection.');
  return value;
 }
 function validateSnapshot(s){
  if(!s||s.snapshotEncoding!==1||!Number.isInteger(s.terrainSeed)||s.terrainSeed<0||s.terrainSeed>4294967295||!Number.isFinite(s.time)||s.time<0)fail('Invalid match snapshot.');
  for(const key of ['units','buildings','regions','bridges','shots','shells','explosions','craters','wrecks'])if(!Array.isArray(s[key])||s[key].length>(key==='regions'?32:2048))fail('Invalid match objects.');
  if(s.units.length>256||s.regions.length!==32||!s.fog||!Number.isInteger(s.fog.cols)||!Number.isInteger(s.fog.rows)||s.fog.cols<1||s.fog.rows<1||s.fog.cols*s.fog.rows>16384)fail('Invalid map snapshot.');
  for(const key of ['visible','explored'])if(typeof s.fog[key]!=='string'||s.fog[key].length>4096)fail('Invalid sight data.');
  if(typeof s.occupation!=='string'||s.occupation.length>32768)fail('Invalid territory data.');
  for(const u of s.units)if(!u||typeof u.id!=='string'||!['blue','red','neutral'].includes(u.side)||!['infantry','mech','tank','artillery'].includes(u.type)||!Number.isFinite(u.x)||!Number.isFinite(u.y)||!Number.isFinite(u.hp))fail('Invalid company data.');
  return s;
 }
 function gather(pc){
  if(pc.iceGatheringState==='complete')return Promise.resolve();
  return new Promise((resolve,reject)=>{
   const clean=()=>{clearTimeout(timer);pc.removeEventListener('icegatheringstatechange',changed);pc.removeEventListener('connectionstatechange',closed);};
   const changed=()=>{if(pc.iceGatheringState==='complete'){clean();resolve();}};
   const closed=()=>{if(pc.connectionState==='closed'){clean();reject(Error('Connection cancelled.'));}};
   const timer=setTimeout(()=>{clean();reject(Error('Network discovery timed out. Check your connection and create a new invite.'));},15000);
   pc.addEventListener('icegatheringstatechange',changed);pc.addEventListener('connectionstatechange',closed);changed();
  });
 }
 function create({onMessage,onStatus,onSignal,Peer=globalThis.RTCPeerConnection,WorkerClass=globalThis.Worker,iceServers=[{urls:'stun:stun.cloudflare.com:3478'}]}={}){
  let pc=null,channel=null,worker=null,host=false,id='',closed=false,started=false,finished=false,localReady=false,remoteReady=false,connected=false;
  let timeout=null,heartbeat=null,lastReceived=0,sequence=0,incoming=null,budget=120,refillAt=0,workerPending=0,packetBudget=80,packetRefill=0;
  const timers=()=>{clearTimeout(timeout);clearInterval(heartbeat);};
  const emit=(type,fields={})=>onMessage?.({v:1,type,...fields});
  function close(){if(closed)return;closed=true;timers();worker?.terminate();worker=null;channel?.close();pc?.close();connected=false;incoming=null;}
  function end(message){if(closed)return;close();emit('error',{code:'MATCH_ENDED',message});}
  function wire(message){
   if(closed||channel?.readyState!=='open')return false;
   if(channel.bufferedAmount>1024*1024){end('The connection cannot keep up. Try a stronger connection and a new invite.');return false;}
   try{channel.send(JSON.stringify({v:1,...message}));return true;}catch{end('The peer connection closed. Create a new invite to play again.');return false;}
  }
  function lobby(){
   const players=[{side:'blue',ready:localReady,connected:true},{side:'red',ready:remoteReady,connected}];
   const base={code:id.slice(0,8).toUpperCase(),public:false,mode:'standard',status:finished?'ended':started?'playing':'waiting',players};
   emit('lobby',{...base,side:'blue',host:true});wire({type:'lobby',...base,side:'red',host:false});
  }
  function sendSnapshot(snapshot){
   if(channel?.readyState!=='open'||channel.bufferedAmount>128*1024)return;
   const text=JSON.stringify(snapshot);if(text.length>MAX_SNAPSHOT){end('This match exceeded the peer snapshot limit.');return;}
   const seq=++sequence,total=Math.ceil(text.length/CHUNK);
   for(let part=0;part<total;part++)if(!wire({type:'snapshot-part',seq,part,total,data:text.slice(part*CHUNK,(part+1)*CHUNK)}))break;
  }
  function startMatch(){
   if(!host||started||!connected||!localReady||!remoteReady)return;
   started=true;worker=new WorkerClass('peer-host-worker.js');
   worker.onerror=()=>end('The host simulation could not start. Reload the game and create a new invite.');
   worker.onmessage=({data})=>{
    if(closed)return;
    if(data.type==='snapshot'){
     if(data.snapshot.winner&&!finished){finished=true;lobby();}
     if(data.side==='blue')emit('snapshot',{snapshot:data.snapshot});else sendSnapshot(data.snapshot);
    }else if(data.type==='error'){
     if(data.side==='blue')emit('error',{message:data.message});else wire({type:'error',message:data.message});
    }else if(data.type==='fatal')end(data.message);
    else if(data.type==='processed')workerPending=Math.max(0,workerPending-1);
   };
   worker.postMessage({type:'start',seed:crypto.getRandomValues(new Uint32Array(1))[0]});lobby();
  }
  function command(side,commands){
   if(!started||!worker||!Array.isArray(commands)||!commands.length||commands.length>60)fail('Invalid company orders.');
   const cost=commands.reduce((n,c)=>n+Math.max(1,Array.isArray(c?.ids)?c.ids.length:1),0);
   const now=Date.now();budget=Math.min(120,budget+(now-refillAt)*.06);refillAt=now;
   if(cost>60||cost>budget||workerPending>=4)fail('Too many orders. Wait a moment before trying again.');
   budget-=cost;workerPending++;worker.postMessage({type:'command',side,commands});
  }
  function receivePart(m){
   if(!Number.isSafeInteger(m.seq)||!Number.isInteger(m.part)||!Number.isInteger(m.total)||m.total<1||m.total>132||m.part<0||m.part>=m.total||typeof m.data!=='string'||m.data.length>CHUNK)fail('Invalid state packet.');
   if(m.part===0)incoming={seq:m.seq,total:m.total,parts:[],length:0};
   if(!incoming||incoming.seq!==m.seq||incoming.total!==m.total||incoming.parts.length!==m.part)fail('Incomplete state packet.');
   incoming.parts.push(m.data);incoming.length+=m.data.length;if(incoming.length>MAX_SNAPSHOT)fail('State packet too large.');
   if(incoming.parts.length===incoming.total){const text=incoming.parts.join('');incoming=null;emit('snapshot',{snapshot:validateSnapshot(parseJSON(text))});}
  }
  function receive(event){
   if(closed)return;
   try{
    const now=Date.now();packetBudget=Math.min(host?80:1024,packetBudget+(now-packetRefill)*(host?.08:1.024));packetRefill=now;if(--packetBudget<0)fail('Peer sent too many messages.');
    if(typeof event.data!=='string'||event.data.length>16384)fail('Peer message too large.');
    const m=parseJSON(event.data);if(!m||m.v!==VERSION)fail('Incompatible game version. Reload both browsers.');lastReceived=Date.now();
    if(m.type==='ping'){wire({type:'pong'});return;}if(m.type==='pong')return;
    if(m.type==='leave'){end('The other commander left. Create a new invite to play again.');return;}
    if(host){
     if(m.type==='ready'&&typeof m.ready==='boolean'&&!started){remoteReady=m.ready;lobby();}
     else if(m.type==='command')command('red',m.commands);
     else fail('Invalid guest message.');
    }else if(m.type==='lobby'){
     if(!Array.isArray(m.players)||m.players.length!==2||!['waiting','playing','ended'].includes(m.status))fail('Invalid lobby.');
     started=m.status!=='waiting';finished=m.status==='ended';emit('lobby',{...m,side:'red',host:false});
    }else if(m.type==='snapshot-part')receivePart(m);
    else if(m.type==='error')emit('error',{message:String(m.message).slice(0,240)});
    else fail('Invalid host message.');
   }catch(error){end(error.message);}
  }
  function attach(ch){
   if(channel&&channel!==ch){ch.close();return;}
   channel=ch;
   if(ch.label!=='living-frontiers-v1'){end('Incompatible peer connection.');return;}
   ch.onmessage=receive;ch.onclose=()=>end('Peer disconnected. The match has ended; create a new invite.');ch.onerror=()=>end('Peer connection failed. Try a new invite or a different network.');
   ch.onopen=()=>{
    if(closed)return;connected=true;clearTimeout(timeout);lastReceived=Date.now();
    onStatus?.('Connected directly. Both commanders must ready up.');
    heartbeat=setInterval(()=>{if(Date.now()-lastReceived>20000)end('The other browser stopped responding. Keep both game tabs open and try a new invite.');else wire({type:'ping'});},4000);
    if(host)lobby();
   };
  }
  function setup(isHost){
   if(pc)fail('Leave this connection before creating another.');
   if(!Peer||!WorkerClass)fail('This browser does not support peer matches. Use a current desktop browser.');
   host=isHost;packetBudget=host?80:1024;pc=new Peer({iceServers});refillAt=Date.now();
   pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed')end('Direct connection failed. These networks may require a relay, which is not enabled. Try another network.');};
   if(host)attach(pc.createDataChannel('living-frontiers-v1',{ordered:true}));else pc.ondatachannel=e=>attach(e.channel);
  }
  function connectionTimeout(ms=30000){clearTimeout(timeout);timeout=setTimeout(()=>end('No direct connection. Check the invite/reply exchange; these networks may need a relay.'),ms);}
  return {
   async host(){setup(true);id=Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,'0')).join('');await pc.setLocalDescription(await pc.createOffer());await gather(pc);if(!closed)onSignal?.(packSignal(pc.localDescription,id),'invite');},
   async join(text){const s=readSignal(text,'offer');setup(false);id=s.id;await pc.setRemoteDescription({type:s.type,sdp:s.sdp});await pc.setLocalDescription(await pc.createAnswer());await gather(pc);if(!closed){onSignal?.(packSignal(pc.localDescription,id),'reply');connectionTimeout(120000);}},
   async accept(text){if(!host||!pc||connected||pc.signalingState!=='have-local-offer')fail('Create an invite before accepting its reply.');const s=readSignal(text,'answer',id);await pc.setRemoteDescription({type:s.type,sdp:s.sdp});connectionTimeout();},
   send(type,data={}){
    if(type==='leave'){wire({type:'leave'});close();return true;}
    if(!connected)return false;
    if(type==='ready'){if(host){localReady=Boolean(data.ready);lobby();}else wire({type:'ready',ready:Boolean(data.ready)});return true;}
    if(type==='start'){startMatch();return true;}
    if(type==='command'){const batch=data.commands||[data.command];if(host){try{command('blue',batch);}catch(error){emit('error',{message:error.message});}}else wire({type:'command',commands:batch});return true;}
    return false;
   },close,
   get connected(){return connected;},get isHost(){return host;}
  };
 }
 return {create,readSignal,packSignal,validateSnapshot};
});
