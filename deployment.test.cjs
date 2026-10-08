'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {build,files,serverURL}=require('./scripts/build-static.cjs');
test('public build includes executable assets and excludes private server files',()=>{
 const output=build('');
 const html=fs.readFileSync(path.join(output,'index.html'),'utf8');
 for(const [,asset] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
  if(!/^(https?:|data:)/.test(asset))assert.ok(fs.existsSync(path.join(output,asset.split('?')[0])),asset);
 }
 for(const privateFile of ['server.cjs','package-lock.json','.git','multiplayer-match.cjs','server.test.cjs'])assert.ok(!fs.existsSync(path.join(output,privateFile)),privateFile);
 assert.match(html,/connect-src 'none'/);
 assert.doesNotMatch(html,/name="multiplayer-server"/);
 assert.ok(files.includes('multiplayer-client.js'));
});
test('configured static multiplayer endpoint is secure and CSP permits only its origin',()=>{
 for(const bad of ['http://example.com/ws','ws://example.com/ws','wss://user:secret@example.com/ws','wss://example.com/ws?token=secret','wss://example.com/ws#token'])assert.throws(()=>serverURL(bad));
 const output=build('wss://example.com/ws'),html=fs.readFileSync(path.join(output,'index.html'),'utf8');
 assert.match(html,/name="multiplayer-server" content="wss:\/\/example.com\/ws"/);
 assert.match(html,/connect-src 'self' wss:\/\/example.com/);
 build('');
});

