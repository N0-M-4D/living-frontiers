'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const P=require('./peer-session.js'),M=require('./multiplayer-match.js');
const SDP='v=0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
test('manual invitations are versioned, bounded, data-only and tied to the host connection',()=>{
 const id='a'.repeat(32),text=P.packSignal({type:'offer',sdp:SDP},id);
 assert.equal(P.readSignal(text,'offer').id,id);
 for(const [s,type,session]of [['junk','offer'],[text,'answer'],[text,'offer','b'.repeat(32)],['x'.repeat(32769),'offer'],[P.packSignal({type:'offer',sdp:SDP+'m=audio 9 UDP/TLS/RTP/SAVPF 111\r\n'},id),'offer']])assert.throws(()=>P.readSignal(s,type,session));
 const poison='LF1.'+btoa('{"v":1,"__proto__":{},"id":"'+id+'","type":"offer","sdp":"v=0"}');assert.throws(()=>P.readSignal(poison,'offer'));
});
test('browser worker runs the actual authoritative simulation without Node globals',()=>{
 const output=[];let tick;const context=vm.createContext({onmessage:null,postMessage:m=>output.push(structuredClone(m)),btoa,atob,setInterval:fn=>{tick=fn;return 1;},clearInterval(){}});
 context.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(file,'utf8'),context,{filename:file}));
 vm.runInContext(fs.readFileSync('peer-host-worker.js','utf8'),context,{filename:'peer-host-worker.js'});
 context.onmessage({data:{type:'start',seed:42}});
 const blue=output.find(m=>m.side==='blue').snapshot,red=output.find(m=>m.side==='red').snapshot;
 assert.equal(blue.units.length,4);assert.equal(red.units.length,4);assert.notEqual(blue.units[0].id,red.units[0].id);assert.ok(P.validateSnapshot(blue));assert.ok(P.validateSnapshot(red));
 context.onmessage({data:{type:'command',side:'red',commands:[{type:'order',ids:[blue.units[0].id],order:'hold'}]}});
 assert.match(output.find(m=>m.type==='error').message,/own companies/);
 const before=red.materiel,barracks=red.buildings.find(b=>b.type==='barracks');
 context.onmessage({data:{type:'command',side:'red',commands:[{type:'recruit',buildingId:barracks.id,kind:'infantry'}]}});
 for(let i=0;i<4;i++)tick();
 const latest=output.filter(m=>m.side==='red'&&m.type==='snapshot').at(-1).snapshot;
 assert.ok(latest.time>0);assert.equal(latest.materiel,before-45);assert.equal(latest.buildings.find(b=>b.id===barracks.id).queue.length,1);
 assert.equal(output.filter(m=>m.type==='processed').length,2);
});
function pair(t){
 const peers=[],workers=[],events={host:[],guest:[]},signals={};
 class Channel{constructor(){this.label='living-frontiers-v1';this.readyState='connecting';this.bufferedAmount=0;this.sent=[];}send(s){this.sent.push(s);this.remote?.onmessage?.({data:s});}close(){this.readyState='closed';}}
 class Peer{constructor(){peers.push(this);this.iceGatheringState='complete';this.connectionState='new';this.signalingState='stable';}createDataChannel(){return this.channel=new Channel();}async createOffer(){return {type:'offer',sdp:SDP};}async createAnswer(){return {type:'answer',sdp:SDP};}async setLocalDescription(d){this.localDescription=d;this.signalingState=d.type==='offer'?'have-local-offer':'stable';}async setRemoteDescription(d){this.remoteDescription=d;this.signalingState='stable';}close(){this.connectionState='closed';}addEventListener(){}removeEventListener(){}}
 class Worker{constructor(){workers.push(this);this.sent=[];}postMessage(m){this.sent.push(m);}terminate(){this.terminated=true;}}
 const host=P.create({Peer,WorkerClass:Worker,onSignal:s=>signals.host=s,onMessage:m=>events.host.push(m)}),guest=P.create({Peer,WorkerClass:Worker,onSignal:s=>signals.guest=s,onMessage:m=>events.guest.push(m)});
 t.after(()=>{host.close();guest.close();});
 return {host,guest,peers,workers,events,async connect(){await host.host();await guest.join(signals.host);await host.accept(signals.guest);const a=peers[0].channel,b=new Channel();a.remote=b;b.remote=a;peers[1].ondatachannel({channel:b});a.readyState=b.readyState='open';b.onopen();a.onopen();return {a,b};}};
}
test('host starts only after both ready; guest orders are always assigned the guest side',async t=>{
 const h=pair(t);await h.connect();h.host.send('start');assert.equal(h.workers.length,0);
 h.host.send('ready',{ready:true});h.guest.send('ready',{ready:true});h.host.send('start');assert.equal(h.workers.length,1);
 assert.equal(h.events.host.at(-1).side,'blue');assert.equal(h.events.guest.at(-1).side,'red');
 h.guest.send('command',{command:{type:'order',side:'blue',ids:['b1'],order:'hold'}});
 assert.equal(h.workers[0].sent.at(-1).side,'red');
 h.host.send('command',{command:{type:'order',ids:['b1'],order:'hold'}});assert.equal(h.workers[0].sent.at(-1).side,'blue');
 h.host.send('leave');assert.equal(h.events.guest.at(-1).code,'MATCH_ENDED');assert.equal(h.workers[0].terminated,true);
});
test('filtered snapshots are chunked and reassembled; incomplete or excessive packets end safely',async t=>{
 const h=pair(t),{a,b}=await h.connect();h.host.send('ready',{ready:true});h.guest.send('ready',{ready:true});h.host.send('start');
 const snapshot=M.snapshotFor(M.createMatch({seed:42}),'red');h.workers[0].onmessage({data:{type:'snapshot',side:'red',snapshot}});
 assert.ok(a.sent.filter(s=>JSON.parse(s).type==='snapshot-part').length>1);assert.deepEqual(h.events.guest.at(-1).snapshot,snapshot);
 b.onmessage({data:JSON.stringify({v:1,type:'snapshot-part',seq:55,part:1,total:2,data:'bad'})});assert.equal(h.events.guest.at(-1).code,'MATCH_ENDED');
});
test('peer command limits reject excessive work before it enters the simulation worker',async t=>{
 const h=pair(t);await h.connect();h.host.send('ready',{ready:true});h.guest.send('ready',{ready:true});h.host.send('start');
 h.guest.send('command',{commands:Array.from({length:61},()=>({type:'order',ids:['x'],order:'hold'}))});
 assert.equal(h.workers[0].sent.length,1);assert.equal(h.events.host.at(-1).code,'MATCH_ENDED');
});
test('normal victory preserves final snapshots and marks both lobbies ended',async t=>{
 const h=pair(t);await h.connect();h.host.send('ready',{ready:true});h.guest.send('ready',{ready:true});h.host.send('start');
 const match=M.createMatch({seed:7});match.winner='blue';
 for(const side of ['blue','red'])h.workers[0].onmessage({data:{type:'snapshot',side,snapshot:M.snapshotFor(match,side)}});
 assert.equal(h.events.host.filter(m=>m.type==='lobby').at(-1).status,'ended');
 assert.equal(h.events.guest.filter(m=>m.type==='lobby').at(-1).status,'ended');
 assert.equal(h.events.guest.at(-1).snapshot.winner,'red');assert.equal(h.guest.connected,true);
});
