(function(root,factory){
 const api=typeof module==='object'&&module.exports?factory(require('./campaign.js'),require('./simulation.js'),require('./territory.js'),require('./fog.js')):factory(root.Campaign,root.Frontiers,root.Territory,root.Fog);
 if(typeof module==='object'&&module.exports)module.exports=api;else root.FrontierMatch=api;
})(globalThis,function(C,F,T,Fog){
'use strict';
const encode=bytes=>typeof Buffer!=='undefined'?Buffer.from(bytes).toString('base64'):btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''));
const other=side=>side==='blue'?'red':'blue';
const clone=value=>JSON.parse(JSON.stringify(value));
function createMatch({seed=1,mode='short'}={}){
 const c=C.create({terrainSeed:seed,mode});c.multiplayer=true;c.faction='union';c.paused=false;c.units=[];c.buildings=[];c.events=[];c.nextBlue=1;c.nextRed=1;c.nextBuilding=1;
 c.materiel=c.enemyFunds=600;c.fuel=c.enemyFuel=220;c.manpower=c.enemyManpower=250;c.autoRetreatSides={blue:true,red:true};c.fogs={};
 for(const r of c.regions){r.owner=r.id==='westhaven'?'blue':r.id==='eastwatch'?'red':'neutral';r.factory.owner=r.owner;r.claimed=r.owner!=='neutral';r.factory.capture=0;if(r.owner!=='neutral')r.production=1.4;}
 for(const cell of c.territory.cells){cell.owner=C.region(c,cell.region).owner;cell.value=cell.owner==='blue'?1:cell.owner==='red'?-1:0;cell.contested=false;}
 for(const side of ['blue','red']){const r=C.region(c,side==='blue'?'westhaven':'eastwatch');for(let i=0;i<4;i++)C.spawn(c,i<2?'tank':'infantry',side,{x:r.x-180+i%2*100,y:r.y-180+Math.floor(i/2)*90});
 for(const [type,dx] of [['barracks',-90],['garage',80],['battery',250]]){const d=C.BUILDINGS[type];c.buildings.push({id:'building-'+c.nextBuilding++,type,name:d.name,x:r.x+dx,y:r.y+100,regionId:r.id,owner:side,hp:d.hp,maxHp:d.hp,level:1,remaining:0,queue:[],rally:{x:r.x,y:r.y-100},repair:false});}}
 for(const r of c.regions.filter(r=>r.owner==='neutral')){const u=C.spawn(c,'infantry','neutral',{x:r.x+100,y:r.y-100});u.hp=u.maxHp=55;u.damage=5;u.militia=true;u.raider=false;}
 C.logistics(c,0);refreshFog(c);return c;
}
// Command helpers are synchronous. Swap only their perspective, and restore even on errors.
function perspective(c,side,fn){if(side==='blue')return fn();const records=[...c.units,...c.buildings,...c.bridges,...c.regions,...c.facilities,...c.territory.cells,...c.shells,...c.shots];const swap=x=>x==='blue'?'red':x==='red'?'blue':x;
 for(const x of records){if(x.side)x.side=swap(x.side);if(x.owner)x.owner=swap(x.owner);}
 const pairs=[['materiel','enemyFunds'],['fuel','enemyFuel'],['manpower','enemyManpower']];for(const [a,b]of pairs)[c[a],c[b]]=[c[b],c[a]];
 const depot=c.depot,fog=c.fog;c.depot=C.region(c,'eastwatch');c.fog=c.fogs.red;
 try{return fn();}finally{c.depot=depot;c.fog=fog;for(const [a,b]of pairs)[c[a],c[b]]=[c[b],c[a]];for(const x of [...c.units,...c.buildings,...c.bridges,...c.regions,...c.facilities,...c.territory.cells,...c.shells,...c.shots]){if(x.side)x.side=swap(x.side);if(x.owner)x.owner=swap(x.owner);}}
}
function refreshFog(c){for(const side of ['blue','red']){const view={time:c.time,units:c.units.filter(u=>u.side===side).map(u=>({...u,side:'blue'})),buildings:c.buildings.filter(b=>b.owner===side).map(b=>({...b,owner:'blue'})),facilities:c.facilities.filter(f=>f.owner===side).map(f=>({...f,owner:'blue'})),fog:c.fogs[side]};Fog.update(view,c.map,true);c.fogs[side]=view.fog;}c.fog=c.fogs.blue;}
function point(c,p){return p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=c.map.bounds.minX&&p.y>=c.map.bounds.minY&&p.x<=c.map.bounds.maxX&&p.y<=c.map.bounds.maxY;}
function applyCommand(c,side,cmd){const fail=message=>({ok:false,message});if(!['blue','red'].includes(side)||!cmd||typeof cmd!=='object'||c.winner)return fail('Invalid command.');
 const ids=cmd.ids;const own=id=>c.units.some(u=>u.id===id&&u.side===side&&u.hp>0);const visible=p=>Fog.visible({fog:c.fogs[side]},p.x,p.y);
 if(['order','bombard','fireMission'].includes(cmd.type)&&(!Array.isArray(ids)||!ids.length||ids.length>60||new Set(ids).size!==ids.length||!ids.every(own)))return fail('Choose your own companies.');
 if(cmd.type==='order'){if(!['move','advance','hold','repair','attack'].includes(cmd.order))return fail('Invalid order.');if(['move','advance'].includes(cmd.order)&&!point(c,cmd.destination))return fail('Invalid destination.');if(cmd.order==='attack'){const target=c.units.find(u=>u.id===cmd.destination&&u.side!==side&&u.hp>0);if(!target||!visible(target))return fail('Target unavailable.');}}
 if(['construct','battery','rally','fireMission'].includes(cmd.type)&&(!point(c,cmd.point)||cmd.point.angle!==undefined&&(!Number.isFinite(cmd.point.angle)||Math.abs(cmd.point.angle)>Math.PI*2)))return fail('Invalid point.');
 if(['recruit','cancelQueue','upgrade','repair','battery','ceaseFire','rally'].includes(cmd.type)&&!c.buildings.some(b=>b.id===cmd.buildingId&&b.owner===side)&&!(cmd.type==='repair'&&c.bridges.some(b=>b.id===cmd.buildingId&&C.at(c,b.x,b.y)?.owner===side)))return fail('Choose your own building.');
 if(['bombard','factoryRepair'].includes(cmd.type)){const r=C.region(c,cmd.regionId),target=cmd.type==='bombard'&&cmd.buildingId?C.infrastructure(c,cmd.buildingId):r?.factory;if(!target||cmd.type==='bombard'&&(!visible(target)||target.owner===side)||cmd.type==='factoryRepair'&&r.owner!==side)return fail('Region unavailable.');}
 if(cmd.type==='construct'&&!Object.hasOwn(C.BUILDINGS,cmd.kind)||cmd.type==='recruit'&&!Object.hasOwn(C.TROOPS,cmd.kind))return fail('Invalid kind.');
 let result;
 try{result=perspective(c,side,()=>{const handlers={
 order:()=>ids.map(id=>F.command(c,id,cmd.order,cmd.destination,{queue:!!cmd.queue})).every(Boolean),
 construct:()=>C.construct(c,cmd.kind,cmd.point), recruit:()=>C.recruit(c,cmd.buildingId,cmd.kind),
 cancelQueue:()=>C.cancelQueue(c,cmd.buildingId),upgrade:()=>C.upgrade(c,cmd.buildingId),repair:()=>{const result=C.repair(c,cmd.buildingId),bridge=c.bridges.find(b=>b.id===cmd.buildingId);if(bridge&&bridge.repair)bridge.repairSide=side;return result;},battery:()=>C.batteryOrder(c,cmd.buildingId,cmd.point),
 ceaseFire:()=>{c.buildings.find(b=>b.id===cmd.buildingId).fireTarget=null;return true;},
 rally:()=>{c.buildings.find(b=>b.id===cmd.buildingId).rally={x:cmd.point.x,y:cmd.point.y};return true;},
 autoRetreat:()=>{if(typeof cmd.enabled!=='boolean')return false;c.autoRetreatSides[side]=cmd.enabled;return true;},
 bombard:()=>ids.map(id=>F.bombard(c,id,cmd.buildingId?C.infrastructure(c,cmd.buildingId):C.region(c,cmd.regionId).factory)).join(' '),
 fireMission:()=>ids.map(id=>F.fireMission(c,id,cmd.point)).join(' '),
 factoryRepair:()=>F.repairFactory(c,C.region(c,cmd.regionId).factory)
 };return Object.hasOwn(handlers,cmd.type)?handlers[cmd.type]():false;});}catch{return fail('Invalid command.');}
 const accepted=typeof result==='string'?/^(infantry queued|mech queued|tank queued|artillery queued|Last order cancelled|Upgraded|Repair crews assigned|Repairs paused|Bombardment ordered|Strike fired|Fire mission launched|Engineers assigned)/.test(result):result!==false;
 return {ok:accepted,message:typeof result==='string'?result:result===false?'Order rejected.':'Order accepted.'};
}
function stepMatch(c,dt){if(c.winner)return;dt=F.clamp(Number.isFinite(dt)?dt:0,0,.1);c.paused=false;F.step(c,dt);T.step(c,dt);C.production(c,dt);C.batteries(c,dt);c.logisticsClock+=dt;
 if(c.logisticsClock>=1){C.logistics(c,c.logisticsClock);for(const side of ['blue','red'])if(c.autoRetreatSides[side])perspective(c,side,()=>{for(const u of c.units.filter(u=>u.side==='blue'&&u.hp>0&&u.hp<u.maxHp*.25&&!['repair','move'].includes(u.order)))F.command(c,u.id,'repair');});c.logisticsClock=0;}
 for(const r of c.regions){r.owner=r.factory.owner;const pool=r.owner==='red'?'enemyFunds':'materiel';if(r.factory.repair&&['blue','red'].includes(r.owner)){const heal=Math.min(8*dt,r.factory.maxHp-r.factory.hp,c[pool]/.8);r.factory.hp+=heal;c[pool]-=heal*.8;}for(const b of c.buildings)if(b.regionId===r.id&&b.owner!==r.owner){b.owner=r.owner;b.queue=[];b.repair=false;b.fireTarget=null;}r.factory.production=r.production*(r.supplied?1:.2);}
 for(const side of ['blue','red']){const count=c.regions.filter(r=>r.owner===side).length;c.score[side]+=count*dt;const required=c.mode==='long'?c.regions.length:Math.ceil(c.regions.length*.6);if(count>=required&&(c.mode==='long'||C.region(c,side==='blue'?'eastwatch':'westhaven').owner===side)){c.winner=side;c.victoryReason='Territorial victory';}if(!c.units.some(u=>u.side===side&&u.hp>0)&&!c.buildings.some(b=>b.owner===side&&b.hp>0&&C.BUILDINGS[b.type].units.length)){c.winner=other(side);c.victoryReason='Field army lost';}}
 if(!c.winner&&c.time>=c.elapsedLimit){c.winner=c.score.blue===c.score.red?'draw':c.score.blue>c.score.red?'blue':'red';c.victoryReason='Campaign time expired';}refreshFog(c);
}
const pick=(obj,keys)=>Object.fromEntries(keys.filter(k=>obj[k]!==undefined).map(k=>[k,clone(obj[k])]));
function packedBits(values){const bytes=new Uint8Array(Math.ceil(values.length/8));values.forEach((value,i)=>{if(value)bytes[i>>3]|=1<<(i&7);});return encode(bytes);}
function packedOccupation(c,side,remap){const bytes=new Uint8Array(c.territory.cells.length*2);c.territory.cells.forEach((cell,i)=>{const owner=remap(cell.owner),value=side==='blue'?cell.value:-cell.value;bytes[i*2]=(owner==='blue'?1:owner==='red'?2:0)|(cell.contested?16:0);bytes[i*2+1]=Math.round((value+1)*127.5);});return encode(bytes);}
function snapshotFor(c,side){if(!['blue','red'].includes(side))throw Error('Invalid side');const remap=x=>x===side?'blue':x===other(side)?'red':x,seen=x=>Fog.visible({fog:c.fogs[side]},x.x,x.y),own=x=>x.side===side||x.owner===side;
 const result=pick(c,['time','terrainSeed','terrainVersion','mode','elapsedLimit','victoryReason']);Object.assign(result,{snapshotEncoding:1,multiplayer:true,paused:false,winner:remap(c.winner),faction:'union',materiel:side==='blue'?c.materiel:c.enemyFunds,fuel:side==='blue'?c.fuel:c.enemyFuel,manpower:side==='blue'?c.manpower:c.enemyManpower,autoRetreat:c.autoRetreatSides[side],depot:pick(C.region(c,side==='blue'?'westhaven':'eastwatch'),['x','y']),score:{blue:c.score[side],red:c.score[other(side)]},fog:{...pick(c.fogs[side],['size','minX','minY','cols','rows','revision','lastUpdate']),visible:packedBits(c.fogs[side].visible),explored:packedBits(c.fogs[side].explored)},events:[]});
 result.units=c.units.filter(u=>u.hp>0&&(own(u)||seen(u))).map(u=>{const v=pick(u,own(u)?['id','name','label','type','x','y','hp','maxHp','angle','turret','range','speed','damage','cooldown','order','path','targetId','moving','status','supply','fuel','supplied','home','commandQueue','repairTarget']:['id','name','label','type','x','y','hp','maxHp','angle','turret','moving']);v.side=remap(u.side);if(!own(u))v.status='Observed enemy';return v;});
 result.buildings=c.buildings.filter(b=>own(b)||seen(b)).map(b=>{const v=pick(b,own(b)?['id','name','type','x','y','regionId','hp','maxHp','level','remaining','queue','rally','repair','fireTarget','cooldown','fireStatus','angle','aim']:['id','name','type','x','y','regionId','hp','maxHp','level','remaining','angle','aim']);v.owner=remap(b.owner);if(!own(b)){v.queue=[];v.rally={x:b.x,y:b.y};}return v;});
 result.regions=c.regions.map(r=>{const v=pick(r,['id','production']);v.owner=remap(r.owner);v.supplied=own(r)?r.supplied:false;v.ground={blue:r.ground?.[side]||0,red:r.ground?.[other(side)]||0};v.factory={};v.factory.owner=v.owner;v.factory.production=own(r.factory)||seen(r.factory)?r.factory.production:r.production;v.factory.hp=own(r.factory)||seen(r.factory)?r.factory.hp:r.factory.maxHp;v.factory.capture=own(r.factory)||seen(r.factory)?r.factory.capture:0;v.factory.repair=own(r.factory)?r.factory.repair:false;return v;});
 result.bridges=c.bridges.map(b=>({...pick(b,['id','index','name','x','y','hp','maxHp']),hp:own(b)||seen(b)?b.hp:b.maxHp,owner:remap(b.owner),repair:own(b)?b.repair:false}));
 result.occupation=packedOccupation(c,side,remap);for(const key of ['shots','shells','explosions','craters','wrecks'])result[key]=(c[key]||[]).filter(x=>seen(x)&&(!Number.isFinite(x.tx)||seen({x:x.tx,y:x.ty}))).map(x=>{const v=clone(x);if(v.side)v.side=remap(v.side);return v;});return result;
}
return {createMatch,stepMatch,applyCommand,snapshotFor};
});
