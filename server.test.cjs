'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {WebSocket}=require('ws');
const {createServer}=require('./server.cjs');
const fakeSim={createMatch:() => ({commands:[],ticks:0}),stepMatch:m=>m.ticks++,applyCommand:(m,side,c)=> {if(c.owner!==side)return {ok:false,message:'Wrong owner.'};m.commands.push({side,c});return {ok:true};},snapshotFor:(m,side)=>({side,ticks:m.ticks,commands:m.commands.length})};
async function connect(port) {
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ws`,{origin:`http://127.0.0.1:${port}`});
  const queue=[];const pending=[];
  ws.on('message',data=> {const message=JSON.parse(data);const idx=pending.findIndex(p=>p.type===message.type);if(idx<0)queue.push(message);else{const p=pending.splice(idx,1)[0];clearTimeout(p.timer);p.resolve(message);}});
  await new Promise((resolve,reject)=> {ws.once('open',resolve);ws.once('error',reject);});
  const client={ws,send:(type,fields={})=>ws.send(JSON.stringify({v:1,type,...fields})),next(type){const idx=queue.findIndex(m=>m.type===type);if(idx>=0)return Promise.resolve(queue.splice(idx,1)[0]);return new Promise((resolve,reject)=>{const item={type,resolve,timer:setTimeout(()=>reject(Error(`Timeout waiting for ${type}`)),10000)};pending.push(item);});},async until(type,predicate){let message;do{message=await this.next(type);}while(!predicate(message));return message;},clear(){queue.length=0;}};
  await client.next('welcome');await client.next('rooms');return client;
}
test('HTTP allowlist and two-player authoritative lobby, ownership and resume',async t=> {
  const app=createServer({simulation:fakeSim,maxRooms:1});const {port}=await app.listen();t.after(()=>app.close());
  assert.equal((await fetch(`http://127.0.0.1:${port}/`)).status,200);
  for(const file of ['server.cjs','package.json','.git/config','%2e%2e/server.cjs'])assert.equal((await fetch(`http://127.0.0.1:${port}/${file}`)).status,404);
  assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status,200);
  assert.equal((await fetch(`http://127.0.0.1:${port}/multiplayer-client.js`)).status,200);
  for(const file of ['model-art-pass','seeded-terrain','visual-research','security-reliability-audit','online-play'])assert.equal((await fetch(`http://127.0.0.1:${port}/docs/${file}.md`)).status,200);
  const a=await connect(port),b=await connect(port);
  a.send('create',{public:true});const host=await a.next('lobby');assert.equal(host.side,'blue');assert.ok(host.token);
  b.clear();b.send('list');const publicList=await b.next('rooms');assert.equal(publicList.rooms[0].code,host.code);assert.equal(JSON.stringify(publicList).includes(host.token),false);
  b.send('create');assert.match((await b.next('error')).message,/limit/);
  b.send('join',{code:host.code});const guest=await b.next('lobby');assert.equal(guest.side,'red');assert.notEqual(guest.token,host.token);
  const hostUpdate=await a.next('lobby');assert.equal(hostUpdate.token,undefined);
  b.send('start');assert.match((await b.next('error')).message,/Host/);
  a.send('ready',{ready:true});b.send('ready',{ready:true});
  // Wait for the authoritative ready broadcasts before starting.
  for(let i=0;i<2;i++)await a.next('lobby');
  a.send('start');await a.next('snapshot');await b.next('snapshot');
  b.send('command',{command:{owner:'blue'}});assert.match((await b.next('error')).message,/owner/);
  b.send('command',{command:{owner:'red'}});await b.until('snapshot',m=>m.snapshot.commands===1);assert.equal(app.rooms.get(host.code).match.commands[0].side,'red');
  b.send('command',{commands:Array.from({length:60},()=>({owner:'red'}))});await b.until('snapshot',m=>m.snapshot.commands===61);assert.equal(app.rooms.get(host.code).match.commands.length,61);
  b.send('command',{commands:Array.from({length:61},()=>({owner:'red'}))});assert.match((await b.next('error')).message,/maximum 60/);assert.equal(app.rooms.get(host.code).match.commands.length,61);
  b.send('command',{commands:[{owner:'red',ids:Array(61).fill('id')}]});assert.match((await b.next('error')).message,/60 company/);
  // Set the work budget explicitly; elapsed time under parallel-suite load is not the behavior under test.
  app.rooms.get(host.code).players.find(p=>p.side==='red').ws.commandBudget=0;
  b.send('command',{commands:Array.from({length:60},()=>({owner:'red'}))});assert.match((await b.next('error')).message,/rate limit/);
  b.ws.close();await new Promise(resolve=>b.ws.once('close',resolve));
  const resumed=await connect(port);resumed.send('resume',{code:host.code,token:host.token});const denied=await resumed.next('error');assert.match(denied.message,/unavailable/);assert.equal(denied.code,'RESUME_EXPIRED');
  resumed.send('resume',{code:host.code,token:guest.token});assert.equal((await resumed.next('lobby')).side,'red');await resumed.next('snapshot');
});
test('origin, payload, protocol and rate limits',async t=> {
  const app=createServer({simulation:fakeSim});const {port}=await app.listen();t.after(()=>app.close());
  const rejected=new WebSocket(`ws://127.0.0.1:${port}/ws`,{origin:'https://untrusted.example'});assert.match((await new Promise(resolve=>rejected.once('error',resolve))).message,/403/);
  const c=await connect(port);c.ws.send('{');assert.equal((await c.next('error')).message,'Invalid JSON.');
  c.ws.send(JSON.stringify({v:2,type:'hello'}));assert.match((await c.next('error')).message,/protocol/);
  for(let i=0;i<45;i++)c.send('list');assert.equal(await new Promise(resolve=>c.ws.once('close',resolve)),1008);
  const large=await connect(port);large.ws.send('x'.repeat(9000));assert.equal(await new Promise(resolve=>large.ws.once('close',resolve)),1009);
});
test('real simulation rejects foreign ownership over two sockets and private rooms stay hidden',async t=> {
  const app=createServer();const {port}=await app.listen();t.after(()=>app.close());
  const a=await connect(port),b=await connect(port);
  a.send('create',{public:false});const host=await a.next('lobby');
  b.clear();b.send('list');assert.deepEqual((await b.next('rooms')).rooms,[]);
  b.send('join',{code:host.code});await b.next('lobby');await a.next('lobby');
  a.send('ready',{ready:true});b.send('ready',{ready:true});for(let i=0;i<2;i++)await a.next('lobby');
  a.send('start');const first=(await a.next('snapshot')).snapshot;assert.equal(first.multiplayer,true);
  const match=app.rooms.get(host.code).match,blue=match.units.find(u=>u.side==='blue'),red=match.units.find(u=>u.side==='red');
  b.send('command',{command:{type:'order',ids:[blue.id],order:'hold'}});assert.match((await b.next('error')).message,/own/);
  b.send('command',{command:{type:'order',ids:[red.id],order:'hold'}});await b.until('snapshot',m=>m.snapshot.units.some(u=>u.id===red.id&&u.order==='hold'));assert.equal(red.order,'hold');
  b.send('leave');const left=await a.next('error');assert.equal(left.code,'MATCH_ENDED');assert.match(left.message,/opponent left/);assert.equal(app.rooms.size,0);
});
test('finished matches send one final state; a failing match cannot stop the server',async t=> {
  let snapshots=0;
  const sim={...fakeSim,stepMatch:match=>{match.winner='blue';},snapshotFor:(m,s)=>{snapshots++;return {...fakeSim.snapshotFor(m,s),winner:m.winner};}};
  const app=createServer({simulation:sim});const {port}=await app.listen();t.after(()=>app.close());
  const a=await connect(port),b=await connect(port);
  a.send('create');const host=await a.next('lobby');b.send('join',{code:host.code});await b.next('lobby');await a.next('lobby');
  a.send('ready',{ready:true});b.send('ready',{ready:true});for(let i=0;i<2;i++)await a.next('lobby');
  a.send('start');await a.next('snapshot');await a.next('snapshot');
  assert.equal(app.rooms.get(host.code).status,'ended');const calls=snapshots;
  await new Promise(resolve=>setTimeout(resolve,230));assert.equal(snapshots,calls);
  // Exercise isolation through the same scheduled server path.
  app.rooms.get(host.code).status='playing';sim.stepMatch=()=>{throw Error('Internal state failure');};
  const stopped=await a.next('error');assert.match(stopped.message,/simulation error/);assert.equal(stopped.code,'MATCH_ENDED');
  assert.equal(app.rooms.size,0);assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status,200);
});
test('expired rooms tell the remaining client to reset and allow a new room',async t=> {
  const app=createServer({simulation:fakeSim});const {port}=await app.listen();t.after(()=>app.close());
  const a=await connect(port),b=await connect(port);
  a.send('create');const host=await a.next('lobby');b.send('join',{code:host.code});await b.next('lobby');await a.next('lobby');
  b.ws.close();await new Promise(resolve=>b.ws.once('close',resolve));
  await a.until('lobby',m=>m.players.some(p=>!p.connected));
  // Expire the disconnected slot explicitly, then observe the real scheduled cleanup.
  app.rooms.get(host.code).players.find(p=>p.side==='red').expires=0;
  const expired=await a.next('error');assert.equal(expired.code,'ROOM_EXPIRED');assert.equal(app.rooms.size,0);
  a.send('create');assert.ok((await a.next('lobby')).token);
});
