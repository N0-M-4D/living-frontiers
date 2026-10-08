'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./multiplayer-match.cjs'),C=require('./campaign.js');
test('balanced opening, independent fog and private snapshots',()=>{
 const c=M.createMatch({seed:23});const blue=M.snapshotFor(c,'blue'),red=M.snapshotFor(c,'red');
 assert.equal(c.units.filter(u=>u.side==='blue').length,4);assert.equal(c.units.filter(u=>u.side==='red').length,4);
 assert.equal(blue.materiel,red.materiel);assert.notDeepEqual(blue.fog.visible,red.fog.visible);
 assert(blue.units.every(u=>u.side==='blue'));assert(red.units.every(u=>u.side==='blue'));
 assert.equal(blue.enemyFunds,undefined);assert.equal(red.enemyManpower,undefined);
 const enemy=c.units.find(u=>u.side==='red');enemy.targetId='secret';enemy.commandQueue=[{order:'move',destination:{x:enemy.x,y:enemy.y},secret:1}];
 const scout=c.units.find(u=>u.side==='blue');scout.x=enemy.x;scout.y=enemy.y;M.stepMatch(c,0);
 const visible=M.snapshotFor(c,'blue').units.find(u=>u.id===enemy.id);assert(visible);assert.equal(visible.targetId,undefined);assert.equal(visible.commandQueue,undefined);
 const enemyBuilding=c.buildings.find(b=>b.owner==='red');enemyBuilding.fireTarget={x:123,y:456};enemyBuilding.queue=[{secret:1}];
 const exposed=M.snapshotFor(c,'blue').buildings.find(b=>b.id===enemyBuilding.id);assert(exposed);assert.deepEqual(exposed.queue,[]);assert.equal(exposed.fireTarget,undefined);
});
test('both humans retain orders and reject foreign, hidden and invalid targets',()=>{
 const c=M.createMatch({seed:23});for(const side of ['blue','red']){const u=c.units.find(u=>u.side===side);assert(M.applyCommand(c,side,{type:'order',ids:[u.id],order:'hold'}).ok);assert(!M.applyCommand(c,side,{type:'order',ids:[c.units.find(v=>v.side!==side).id],order:'hold'}).ok);assert(!M.applyCommand(c,side,{type:'order',ids:[u.id],order:'move',destination:{x:Infinity,y:0}}).ok);assert(!M.applyCommand(c,side,{type:'order',ids:[u.id],order:'attack',destination:c.units.find(v=>v.side=== (side==='blue'?'red':'blue')).id}).ok);}
 for(let i=0;i<260;i++)M.stepMatch(c,.05);assert(c.units.filter(u=>u.side!=='neutral').every(u=>u.order==='hold'));
 assert(c.units.filter(u=>u.side==='red').every(u=>u.side==='red'));assert(c.buildings.filter(b=>b.regionId==='eastwatch').every(b=>b.owner==='red'));
});
test('red recruitment uses own funds and returns canonical ownership',()=>{
 const c=M.createMatch({seed:23}),b=c.buildings.find(b=>b.owner==='red'&&b.type==='barracks');const blueFunds=c.materiel;
 assert(M.applyCommand(c,'red',{type:'recruit',buildingId:b.id,kind:'infantry'}).ok);assert.equal(c.enemyFunds,555);assert.equal(c.materiel,blueFunds);assert.equal(b.owner,'red');
 for(let i=0;i<250;i++)M.stepMatch(c,.05);assert.equal(c.units.filter(u=>u.side==='red').length,5);assert.equal(b.queue.length,0);
});
test('neutral defenders fight either side without claiming territory; both sides capture towns',()=>{
 for(const side of ['blue','red']){const c=M.createMatch({seed:23}),r=c.regions.find(r=>r.owner==='neutral'),guard=c.units.find(u=>u.side==='neutral'&&C.at(c,u.x,u.y)?.id===r.id),u=c.units.find(u=>u.side===side);
 assert(guard);u.x=guard.x;u.y=guard.y;const hp=u.hp;M.stepMatch(c,.1);assert(u.hp<hp);guard.hp=0;
 for(const v of c.units)if(v.side==='neutral'&&Math.hypot(v.x-r.x,v.y-r.y)<800)v.hp=0;
 u.x=r.x;u.y=r.y;for(const cell of c.territory.cells.filter(x=>x.region===r.id)){cell.owner=side;cell.value=side==='blue'?1:-1;}
 for(let i=0;i<180;i++)M.stepMatch(c,.05);assert.equal(r.owner,side);
 }
});

test('equal capital income and resource rejection reports false',()=>{
 const c=M.createMatch({seed:23});for(let i=0;i<100;i++)M.stepMatch(c,.05);assert(Math.abs(c.materiel-c.enemyFunds)<1e-8);assert(Math.abs(c.fuel-c.enemyFuel)<1e-8);assert(Math.abs(c.manpower-c.enemyManpower)<1e-8);
 c.enemyFunds=0;const b=c.buildings.find(b=>b.owner==='red'&&b.type==='barracks');assert.equal(M.applyCommand(c,'red',{type:'recruit',buildingId:b.id,kind:'infantry'}).ok,false);assert.equal(M.applyCommand(c,'red',{type:'recruit',buildingId:b.id,kind:'made-up'}).ok,false);
});
test('prototype kinds and invalid trench angles cannot mutate economy or buildings',()=>{
 const c=M.createMatch({seed:23}),b=c.buildings.find(b=>b.owner==='red'&&b.type==='barracks'),p={x:5000,y:5000};
 const before=JSON.stringify([c.materiel,c.enemyFunds,c.fuel,c.enemyFuel,c.manpower,c.enemyManpower,c.buildings]);
 for(const kind of ['__proto__','constructor'])for(const type of ['construct','recruit'])assert.equal(M.applyCommand(c,'red',{type,kind,point:p,buildingId:b.id}).ok,false);
 assert.equal(M.applyCommand(c,'red',{type:'construct',kind:'trench',point:{...p,angle:Infinity}}).ok,false);
 assert.equal(JSON.stringify([c.materiel,c.enemyFunds,c.fuel,c.enemyFuel,c.manpower,c.enemyManpower,c.buildings]),before);
});
test('red artillery and direct strikes preserve canonical effect sides and spare friendly troops',()=>{
 const c=M.createMatch({seed:23}),target=c.units.find(u=>u.side==='blue'),friendly=c.units.find(u=>u.side==='red');
 const artillery=C.spawn(c,'artillery','red',{x:target.x+450,y:target.y});
 friendly.x=target.x;friendly.y=target.y;target.cooldown=friendly.cooldown=1e6;c.units=[target,friendly,artillery];
 const oldShell={x:target.x,y:target.y,tx:target.x,ty:target.y,side:'blue',remaining:100,total:100,damage:20,radius:20};c.shells.push(oldShell);
 const oldShot={x:target.x,y:target.y,tx:target.x,ty:target.y,side:'red',ttl:100};c.shots.push(oldShot);
 const targetHp=target.hp,friendlyHp=friendly.hp;
 assert.equal(M.applyCommand(c,'red',{type:'fireMission',ids:[artillery.id],point:{x:target.x,y:target.y}}).ok,true);
 assert.equal(c.shells.at(-1).side,'red');assert.equal(oldShell.side,'blue');assert.equal(oldShot.side,'red');
 for(let i=0;i<40;i++)M.stepMatch(c,.05);
 assert(target.hp<targetHp,'red shell must damage the blue target');assert.equal(friendly.hp,friendlyHp,'red shell must spare red troops at impact');
 const factory=C.region(c,'westhaven').factory;friendly.x=factory.x+50;friendly.y=factory.y;friendly.cooldown=0;M.stepMatch(c,0);
 assert.equal(M.applyCommand(c,'red',{type:'bombard',ids:[friendly.id],regionId:'westhaven'}).ok,true);
 assert.equal(c.shots.at(-1).side,'red');
});
test('compact snapshots preserve fog and occupation with bounded quantization',()=>{
 const c=M.createMatch({seed:23});c.territory.cells[0].value=.372;c.territory.cells[0].contested=true;
 for(const side of ['blue','red']){const snapshot=M.snapshotFor(c,side);assert.equal(snapshot.snapshotEncoding,1);assert(Buffer.byteLength(JSON.stringify(snapshot))<22000);
 for(const kind of ['visible','explored']){const bytes=Buffer.from(snapshot.fog[kind],'base64'),decoded=c.fogs[side][kind].map((_,i)=>(bytes[i>>3]>>(i&7))&1);assert.deepEqual(decoded,c.fogs[side][kind]);}
 const bytes=Buffer.from(snapshot.occupation,'base64');assert.equal(bytes.length,c.territory.cells.length*2);
 c.territory.cells.forEach((cell,i)=>{const localOwner=cell.owner===side?1:cell.owner==='neutral'?0:2;assert.equal(bytes[i*2]&3,localOwner);assert.equal(!!(bytes[i*2]&16),cell.contested);assert(Math.abs(bytes[i*2+1]/127.5-1-(side==='blue'?cell.value:-cell.value))<=1/255+1e-9);});
 assert(snapshot.regions.every(r=>!Object.hasOwn(r,'polygon')&&!Object.hasOwn(r.factory,'x')));
 }
});
test('inherited command names are rejected without state mutation',()=>{
 const c=M.createMatch({seed:23});const before=JSON.stringify([c.time,c.materiel,c.enemyFunds,c.fuel,c.enemyFuel,c.manpower,c.enemyManpower,c.units,c.buildings,c.bridges,c.shells,c.shots,c.autoRetreatSides]);
 for(const side of ['blue','red'])for(const type of ['constructor','toString','__proto__','hasOwnProperty'])assert.equal(M.applyCommand(c,side,{type}).ok,false);
 assert.equal(JSON.stringify([c.time,c.materiel,c.enemyFunds,c.fuel,c.enemyFuel,c.manpower,c.enemyManpower,c.units,c.buildings,c.bridges,c.shells,c.shots,c.autoRetreatSides]),before);
});
