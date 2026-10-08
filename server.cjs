'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {WebSocketServer, WebSocket} = require('ws');
const simulation = require('./multiplayer-match.js');
const FILES = new Set(['index.html','styles.css','fog.js','projection.js','ground-detail.js','simulation.js','geography.js','terrain-art.js','terrain.js','world.js','territory.js','save-validation.js','campaign.js','models.js','game.js','multiplayer-client.js','peer-session.js','peer-host-worker.js','multiplayer-match.js','docs/online-play.md','preview/visual-lab.html','preview/visual-lab.css','preview/visual-lab.js','preview/model-yard.html','preview/model-yard.css','preview/model-yard.js']);
for(const name of ['model-art-pass','seeded-terrain','visual-research','security-reliability-audit']) FILES.add(`docs/${name}.md`);
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8'};
const CSP = "default-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
function createServer(options = {}) {
  const rooms = new Map();
  const maxRooms = options.maxRooms ?? 32;
  const grace = options.reconnectGraceMs ?? 60000;
  const allowedOrigins = options.allowedOrigins ?? (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
  const sim = options.simulation ?? simulation;
  let closing = false;
  const server = http.createServer((req,res) => {
    res.setHeader('Content-Security-Policy',CSP);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Cache-Control','no-store');
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    let name;
    try { name = decodeURIComponent(new URL(req.url,'http://local').pathname).slice(1) || 'index.html'; }
    catch { res.writeHead(400); res.end(); return; }
    if (name === 'healthz') {res.writeHead(200,{'Content-Type':'application/json'});res.end(req.method === 'HEAD' ? undefined : '{"ok":true}');return;}
    if (!FILES.has(name)) {res.writeHead(404);res.end();return;}
    fs.readFile(path.join(__dirname,name),(error,data) => {
      if (error) {res.writeHead(404);res.end();return;}
      res.writeHead(200,{'Content-Type':MIME[path.extname(name)] || 'application/octet-stream'});
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
  const wss = new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});
  server.on('upgrade',(req,socket,head) => {
    const origin = req.headers.origin;
    let sameOrigin = false;
    try {const parsed = new URL(origin);sameOrigin = ['http:','https:'].includes(parsed.protocol) && parsed.host === req.headers.host;} catch {}
    if (closing || req.url !== '/ws' || (!sameOrigin && !allowedOrigins.includes(origin)) || wss.clients.size >= 128) {
      socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;
    }
    wss.handleUpgrade(req,socket,head,ws => wss.emit('connection',ws));
  });
  function send(ws,type,fields = {}) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (ws.bufferedAmount > 1024 * 1024) {ws.close(1013,'Client too slow');return;}
    const payload = JSON.stringify({v:1,type,...fields});
    if (payload.length > 1024 * 1024) {ws.close(1011,'Snapshot too large');return;}
    ws.send(payload);
  }
  function list(ws) {send(ws,'rooms',{rooms:[...rooms.values()].filter(r => r.public).map(r => ({code:r.code,players:r.players.length,mode:r.mode,status:r.status}))});}
  function lobby(room,assigned) {
    for (const player of room.players) send(player.ws,'lobby',{
      code:room.code,public:room.public,mode:room.mode,status:room.status,side:player.side,host:player === room.players[0],
      players:room.players.map(p => ({side:p.side,ready:p.ready,connected:!!p.ws})),
      ...(player === assigned ? {token:player.token} : {})
    });
  }
  function detach(ws,permanent = false) {
    const room = ws.room, player = ws.player;
    ws.room = ws.player = null;
    if (!room || player.ws !== ws) return;
    player.ws = null;
    player.expires = Date.now() + grace;
    if (permanent && room.status === 'waiting') room.players.splice(room.players.indexOf(player),1);
    if (permanent && room.status === 'playing') {
      for(const p of room.players) {
        send(p.ws,'error',{code:'MATCH_ENDED',message:'The opponent left this match.'});
        if(p.ws){p.ws.room=p.ws.player=null;}
      }
      rooms.delete(room.code);return;
    }
    if (!room.players.length) rooms.delete(room.code); else lobby(room);
  }
  function assign(ws,room,player) {
    if (ws.room) throw Error('Leave your current room first.');
    ws.room = room;ws.player = player;player.ws = ws;player.expires = null;
    lobby(room,player);
    if (room.match) send(ws,'snapshot',{snapshot:sim.snapshotFor(room.match,player.side)});
  }
  wss.on('connection',ws => {
    ws.alive = true;ws.budget = 40;ws.commandBudget=120;ws.refillAt = Date.now();
    ws.on('pong',() => {ws.alive = true;});
    ws.on('error',() => {});
    send(ws,'welcome',{protocol:1});list(ws);
    ws.on('close',() => detach(ws));
    ws.on('message',(data,isBinary) => {
      const now = Date.now();
      ws.budget = Math.min(40,ws.budget + (now-ws.refillAt)*0.02);
      ws.commandBudget=Math.min(120,ws.commandBudget+(now-ws.refillAt)*0.06);ws.refillAt = now;
      if (--ws.budget < 0) {ws.close(1008,'Rate limit');return;}
      try {
        if (isBinary) throw Error('Use JSON text messages.');
        const msg = JSON.parse(data.toString());
        if (!msg || msg.v !== 1 || typeof msg.type !== 'string') throw Error('Unsupported protocol.');
        const room = ws.room, player = ws.player;
        switch (msg.type) {
          case 'hello': send(ws,'welcome',{protocol:1});list(ws);break;
          case 'list': list(ws);break;
          case 'create': {
            if (room) throw Error('Leave your current room first.');
            if (rooms.size >= maxRooms) throw Error('Server room limit reached.');
            if (msg.mode !== undefined && msg.mode !== 'standard') throw Error('Unsupported game mode.');
            let code;do {code=crypto.randomBytes(5).toString('hex').toUpperCase();} while(rooms.has(code));
            const created = {code,public:msg.public === true,mode:'standard',status:'waiting',seed:crypto.randomInt(1,2147483647),players:[],match:null,created:now};
            const host = {side:'blue',token:crypto.randomBytes(32).toString('base64url'),ready:false,ws:null};
            created.players.push(host);rooms.set(code,created);assign(ws,created,host);break;
          }
          case 'join': {
            if (room) throw Error('Leave your current room first.');
            const target = rooms.get(typeof msg.code === 'string' ? msg.code.toUpperCase() : '');
            if (!target || target.status !== 'waiting' || target.players.length >= 2) throw Error('Room unavailable.');
            const joined = {side:target.players.some(p => p.side === 'blue') ? 'red' : 'blue',token:crypto.randomBytes(32).toString('base64url'),ready:false,ws:null};
            target.players.push(joined);assign(ws,target,joined);break;
          }
          case 'resume': {
            const target = rooms.get(typeof msg.code === 'string' ? msg.code.toUpperCase() : '');
            const resumed = target && typeof msg.token === 'string' && target.players.find(p => p.token && p.token === msg.token);
            if (!resumed || resumed.ws || (resumed.expires && resumed.expires < now)) {const error=Error('Session unavailable.');error.code='RESUME_EXPIRED';throw error;}
            assign(ws,target,resumed);break;
          }
          case 'ready':
            if (!room || room.status !== 'waiting' || typeof msg.ready !== 'boolean') throw Error('Cannot change ready state.');
            player.ready=msg.ready;lobby(room);break;
          case 'start':
            if (!room || room.status !== 'waiting' || room.players[0] !== player || room.players.length !== 2 || !room.players.every(p => p.ready && p.ws)) throw Error('Host can start once both players are connected and ready.');
            room.match=sim.createMatch({seed:room.seed,mode:room.mode});room.status='playing';lobby(room);
            for (const p of room.players) send(p.ws,'snapshot',{snapshot:sim.snapshotFor(room.match,p.side)});
            break;
          case 'command': {
            if (!room || room.status !== 'playing' || !room.players.every(p => p.ws)) throw Error('Match is not running or an opponent is reconnecting.');
            if (msg.command !== undefined && msg.commands !== undefined) throw Error('Send one command or one batch.');
            const commands=msg.commands === undefined ? [msg.command] : msg.commands;
            if (!Array.isArray(commands) || commands.length < 1 || commands.length > 60 || commands.some(c => !c || typeof c !== 'object' || Array.isArray(c))) throw Error('Invalid command batch (maximum 60).');
            const work=commands.reduce((total,c) => total+Math.max(1,Array.isArray(c.ids) ? c.ids.length : 1),0);
            if (work > 60) throw Error('Command batch exceeds 60 company actions.');
            if (ws.commandBudget < work) throw Error('Command rate limit: wait before issuing more orders.');
            ws.commandBudget-=work;
            let rejected;
            for(const command of commands) {
              const result = sim.applyCommand(room.match,player.side,command);
              if (!result.ok && !rejected) rejected=result.message || 'Command rejected.';
            }
            if (rejected) throw Error(rejected);
            break;
          }
          case 'leave': detach(ws,true);send(ws,'welcome',{protocol:1});list(ws);break;
          default: throw Error('Unknown message type.');
        }
      } catch(error) {send(ws,'error',{message:error instanceof SyntaxError ? 'Invalid JSON.' : error.message,...(error.code === 'RESUME_EXPIRED' ? {code:error.code} : {})});}
    });
  });
  let tick = 0;
  const interval = setInterval(() => {
    const now=Date.now();tick++;
    for (const room of rooms.values()) {
      if (room.players.some(p => !p.ws && p.expires < now) || (room.status === 'waiting' && now-room.created > 3600000)) {
        for (const p of room.players) {send(p.ws,'error',{code:'ROOM_EXPIRED',message:'Room expired.'});if(p.ws){p.ws.room=p.ws.player=null;}}
        rooms.delete(room.code);continue;
      }
      try {
        if (room.status === 'playing' && room.players.every(p => p.ws)) {
          sim.stepMatch(room.match,0.05);
          if (room.match.winner) {
            room.status='ended';lobby(room);
            for(const p of room.players) send(p.ws,'snapshot',{snapshot:sim.snapshotFor(room.match,p.side)});
          }
        }
        if (room.match && room.status === 'playing' && tick % 4 === 0) for (const p of room.players) send(p.ws,'snapshot',{snapshot:sim.snapshotFor(room.match,p.side)});
      } catch {
        for(const p of room.players) {send(p.ws,'error',{code:'MATCH_ENDED',message:'This match stopped because of a server simulation error.'});if(p.ws){p.ws.room=p.ws.player=null;}}
        rooms.delete(room.code);
      }
    }
  },50);
  const heartbeat = setInterval(() => {for (const ws of wss.clients) {if (!ws.alive) ws.terminate();else {ws.alive=false;ws.ping();}}},15000);
  async function close() {
    closing=true;clearInterval(interval);clearInterval(heartbeat);
    for(const ws of wss.clients) ws.terminate();
    await new Promise(resolve => wss.close(resolve));
    await new Promise(resolve => server.close(resolve));
  }
  return {server,rooms,close,listen:(port=0,host='127.0.0.1') => new Promise(resolve => server.listen(port,host,() => resolve(server.address())))};
}
module.exports={createServer};
if(require.main === module) {
  const app=createServer();app.listen(Number(process.env.PORT)||8765,process.env.HOST || '0.0.0.0').then(address => console.log(`Living Frontiers listening on port ${address.port}`));
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,() => app.close().then(() => process.exit(0)));
}
