/* Local saves are data, not trusted runtime objects. Validate before restoration. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SaveValidation=api;})(globalThis,function(){
 'use strict';
 const NUMERIC_FIELDS=new Set('x y tx ty hp maxHp angle turret aim level remaining total ttl range size velocity supply fuel speed damage cooldown'.split(' '));
 const MAX_CHARS=4*1024*1024,SIDES=['blue','red','neutral'];
 function requireValue(ok,label){if(!ok)throw Error('Invalid save: '+label+'.');}
 function object(value,label){requireValue(value!==null&&typeof value==='object'&&!Array.isArray(value),label);}
 function number(value,label,min=-1e12,max=1e12){requireValue(Number.isFinite(value)&&value>=min&&value<=max,label);}
 function list(value,label,max){requireValue(Array.isArray(value)&&value.length<=max,label);}
 function choice(value,values,label){requireValue(values.includes(value),label);}
 function point(value){object(value,'position');number(value.x,'x coordinate',-100000,100000);number(value.y,'y coordinate',-100000,100000);}
 function health(value){point(value);number(value.hp,'health',0);number(value.maxHp,'maximum health',.001);requireValue(value.hp<=value.maxHp,'health exceeds maximum');}
 function unique(items,label){const ids=new Set();for(const item of items){object(item,label);requireValue(typeof item.id==='string'&&item.id.length>0&&!ids.has(item.id),label+' identity');ids.add(item.id);}}
 function path(value){list(value,'route',256);value.forEach(point);}
 function queue(value,troops){list(value,'production queue',5);for(const q of value){choice(q.type,Object.keys(troops),'recruit type');number(q.remaining,'recruit time');number(q.total,'recruit duration',.001);object(q.cost,'recruit cost');for(const k of ['materiel','fuel','manpower'])number(q.cost[k],'recruit cost',0);}}
 function unit(u,troops){
  health(u);choice(u.type,Object.keys(troops),'unit type');choice(u.side,['blue','red'],'unit side');
  requireValue(typeof u.name==='string','unit name');requireValue(typeof u.status==='string','unit status');
  choice(u.order,['hold','move','advance','attack','repair','withdraw'],'unit order');path(u.path);point(u.home);
  for(const k of ['speed','damage','range','cooldown'])number(u[k],'unit '+k,0);
  for(const k of ['angle','turret','aiTimer'])number(u[k],'unit '+k);
  for(const key of ['objective','repairTarget'])if(u[key]!=null)point(u[key]);
  if(u.commandQueue){list(u.commandQueue,'order queue',32);for(const q of u.commandQueue){choice(q.order,['move','advance'],'queued order');point(q.destination);}}
 }
 function building(b,buildings,troops,ids){health(b);choice(b.type,Object.keys(buildings),'building type');choice(b.owner,SIDES,'building owner');choice(b.regionId,ids,'building region');number(b.remaining,'construction time',0);number(b.level,'building level',1,3);point(b.rally);queue(b.queue,troops);if(b.fireTarget)point(b.fireTarget);}
 function region(r,expected){
  requireValue(r.id===expected.id,'region identity');choice(r.owner,SIDES,'region owner');health(r.factory);choice(r.factory.owner,SIDES,'facility owner');number(r.factory.capture,'capture',0,100);
  // Authored geometry is never loaded from storage.
  for(const k of ['name','x','y','polygon','neighbours','facility','production','reward','biome'])r[k]=expected[k];
  r.factory.x=expected.x;r.factory.y=expected.y;
 }
 function occupation(value,expected){list(value,'occupation',expected.length);requireValue(value.length===expected.length,'occupation size');for(const cell of value){list(cell,'occupation cell',3);requireValue(cell.length===3,'occupation tuple');choice(cell[0],SIDES,'occupation owner');number(cell[1],'occupation pressure',-1,1);requireValue(typeof cell[2]==='boolean','occupation contest');}}
 function fog(data,expected){
  if(!data.fog)return;
  const source=data.fog;object(source,'fog');
  for(const k of ['cols','rows','size','minX','minY'])requireValue(source[k]===expected[k],'fog dimensions');
  list(source.explored,'exploration',expected.explored.length);requireValue(source.explored.length===expected.explored.length,'exploration size');
  for(const v of source.explored)choice(v,[0,1],'exploration cell');
  data.fog={...expected,explored:source.explored.slice()};
 }
 function primitives(data){
  const pending=[{value:data,depth:0}];let visited=0;
  while(pending.length){const {value,depth}=pending.pop();requireValue(++visited<=150000&&depth<=16,'data complexity');
   if(typeof value==='number')number(value,'numeric value');
   if(typeof value==='string')requireValue(value.length<=2048,'text length');
   if(value===null||typeof value!=='object')continue;
   for(const [key,child] of Object.entries(value)){requireValue(!['__proto__','constructor','prototype'].includes(key),'reserved property');if(NUMERIC_FIELDS.has(key))number(child,key);pending.push({value:child,depth:depth+1});}
  }
 }
 function parse(text){requireValue(typeof text==='string'&&text.length<=MAX_CHARS,'file size');const envelope=JSON.parse(text);object(envelope,'envelope');requireValue(envelope.version===1,'version');object(envelope.payload,'payload');primitives(envelope.payload);return envelope.payload;}
 function validate(data,base,buildings,troops){
  const keys=new Set([...Object.keys(base),'occupation','victoryReason']);
  for(const k of Object.keys(data))requireValue(keys.has(k)&&!['map','facilities','territory','terrainMap','_combatIndex'].includes(k),'campaign property '+k);
  for(const [key,value] of Object.entries(base)){if(typeof value==='number')number(data[key],'campaign '+key);if(typeof value==='boolean')requireValue(typeof data[key]==='boolean','campaign '+key);}
  choice(data.faction,['union','vanguard','rangers'],'faction');choice(data.mode,['short','long'],'mode');choice(data.winner,[null,'blue','red'],'winner');
  const ids=base.regions.map(r=>r.id);choice(data.selectedRegion,ids,'selected region');
  list(data.regions,'regions',ids.length);requireValue(data.regions.length===ids.length,'regions size');data.regions.forEach((r,i)=>region(r,base.regions[i]));
  list(data.units,'units',2048);unique(data.units,'unit');data.units.forEach(u=>unit(u,troops));
  list(data.buildings,'buildings',80);unique(data.buildings,'building');data.buildings.forEach(b=>building(b,buildings,troops,ids));
  validateBridges(data.bridges,base.bridges);validateEffects(data);point(data.depot);
  object(data.score,'score');number(data.score.blue,'blue score',0);number(data.score.red,'red score',0);
  occupation(data.occupation,base.territory.cells);fog(data,base.fog);
  return data;
 }
 function validateBridges(bridges,expected){list(bridges,'bridges',expected.length);requireValue(bridges.length===expected.length,'bridge count');bridges.forEach((b,i)=>{health(b);requireValue(b.id===expected[i].id&&b.index===i,'bridge identity');b.x=expected[i].x;b.y=expected[i].y;choice(b.owner,SIDES,'bridge owner');});}
 function validateEffects(data){
  for(const [key,max] of Object.entries({events:8,shots:160,wrecks:180,shells:96,explosions:96,craters:120})){list(data[key],key,max);data[key].forEach(v=>object(v,key+' item'));}
  for(const key of ['shots','wrecks','shells','explosions','craters'])data[key].forEach(point);
  validateTransientEffects(data);
  for(const shell of data.shells){number(shell.total,'shell duration',.001);number(shell.remaining,'shell time');number(shell.radius,'blast radius',0,10000);number(shell.damage,'shell damage',0);number(shell.tx,'shell destination');number(shell.ty,'shell destination');choice(shell.side,['blue','red'],'shell side');}
 }
 function validateTransientEffects(data){
  for(const e of data.events){requireValue(typeof e.message==='string','event text');number(e.time,'event time',0);}
  for(const w of data.wrecks){choice(w.type,['tank','mech','infantry','artillery'],'wreck type');number(w.angle,'wreck angle');}
  for(const s of data.shots){number(s.tx,'shot destination');number(s.ty,'shot destination');number(s.ttl,'shot lifetime',0);choice(s.side,['blue','red'],'shot side');}
  for(const e of data.explosions){number(e.total,'effect duration',.001);number(e.ttl,'effect lifetime');number(e.size,'effect size',0,10000);}
  for(const c of data.craters)number(c.size,'crater size',0,10000);
 }
 return {parse,validate,MAX_CHARS};
});
