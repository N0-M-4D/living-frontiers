const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),C=require('./campaign.js');
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const original=C.serialize(C.create()),edit=fn=>{const data=JSON.parse(original);fn(data.payload);return JSON.stringify(data);};
test('Save names remain plain data and cannot become HTML in the formation list',()=>{
 const source=fs.readFileSync('game.js','utf8'),start=source.indexOf('function makeFormationButtons()'),end=source.indexOf('\n',start),nodes=[];
 function element(tag){const el={tag,children:[],dataset:{},append(...items){this.children.push(...items);},appendChild(item){this.children.push(item);},replaceChildren(...items){this.children=items;},add(item){this.children.push(item);}};Object.defineProperty(el,'innerHTML',{set(){throw Error('HTML sink used');}});nodes.push(el);return el;}
 const picker=element('select'),list=element('div'),name='<img src=x onerror="alert(1)">',state=C.restore(edit(d=>d.units[0].name=name));
 vm.runInNewContext(source.slice(start,end)+';makeFormationButtons();',{state,document:{createElement:element},$:id=>id==='unit-picker'?picker:list,Option:function(text,value){this.text=text;this.value=value;},select(){}});
 assert.ok(nodes.some(n=>n.tag==='strong'&&n.textContent===name));assert.equal(list.children.length,12);
});
test('Prototype keys and unknown runtime properties are rejected before restoration',()=>{
 for(const key of ['__proto__','constructor','prototype','map','terrainMap'])assert.throws(()=>C.restore(edit(d=>Object.defineProperty(d,key,{value:{injected:true},enumerable:true}))),/Invalid save/);
 assert.equal({}.injected,undefined);
});
test('Invalid unit types, coordinates, paths and orders cannot enter the simulation',()=>{
 for(const change of [d=>d.units[0].type='constructor',d=>d.units[0].x='bad',d=>d.units[0].range=-1,d=>d.units[0].angle='bad',d=>d.units[0].maxHp=0,d=>d.units[0].path=[{x:null,y:0}],d=>d.units[0].commandQueue=[{order:'move',destination:{x:1,y:'bad'}}],d=>d.units[0].objective={x:0,y:'bad'}])assert.throws(()=>C.restore(edit(change)),/Invalid save/);
});
test('Bad buildings, duplicate identities and malformed production are rejected',()=>{
 for(const change of [d=>d.buildings[0].type='bad',d=>d.buildings[0].rally=null,d=>d.units[1].id=d.units[0].id,d=>d.buildings[0].queue=[{type:'infantry',remaining:1,total:10,cost:{materiel:-500,fuel:0,manpower:0}}]])assert.throws(()=>C.restore(edit(change)),/Invalid save/);
});
test('Forged fog dimensions and invalid occupation cannot allocate a giant grid',()=>{
 for(const change of [d=>d.fog.cols=1e10,d=>d.fog.explored=[],d=>d.occupation[0][1]=2,d=>d.occupation[0][2]='yes',d=>d.bridges[0].index=2,d=>d.selectedRegion='missing'])assert.throws(()=>C.restore(edit(change)),/Invalid save/);
});
test('Save size and nesting are bounded before campaign construction',()=>{
 assert.throws(()=>C.restore(' '.repeat(4*1024*1024+1)),/file size/);
 assert.throws(()=>C.restore(edit(d=>{let p=d;for(let i=0;i<25;i++)p=p.nested={};})),/complexity/);
});
test('Saved geometry uses authored regions and fog visibility is rebuilt',()=>{
 const restored=C.restore(edit(d=>{d.regions[0].polygon=[[0,0],[1,1]];d.fog.visible.fill(1);}));assert.deepEqual(restored.regions[0].polygon,C.create().regions[0].polygon);assert.ok(restored.fog.visible.some(v=>v===0));
});
test('Active campaigns still round-trip after combat and production',()=>{
 const c=C.create({terrainSeed:823901});C.recruit(c,c.buildings[0].id,'infantry');for(let i=0;i<1200;i++)C.step(c,.05);const restored=C.restore(C.serialize(c));restored.paused=false;C.step(restored,.05);assert.ok(Number.isFinite(restored.units[0].x));assert.equal(restored.terrainSeed,823901);
});
test('Idle paused and concluded campaigns stop periodic renders while input still redraws',()=>{
 const source=fs.readFileSync('game.js','utf8'),start=source.indexOf('function advanceCamera(now)'),end=source.indexOf('\n  terrainBase();',start),frame=source.slice(start,end);
 for(const state of [{paused:true},{paused:false,winner:'blue'}]){let draws=0,ui=0;const context={state,last:0,accumulator:0,cameraTween:null,paintNeeded:true,fpsFrames:0,fpsStart:0,fps:0,uiTime:0,document:{hidden:false},Campaign:{step(){}},render(){draws++;},updateUI(){ui++;context.paintNeeded=true;},requestAnimationFrame(){}};vm.createContext(context);vm.runInContext(frame,context);for(let i=1;i<=60;i++)context.frame(i*17);assert.equal(draws,1);assert.equal(ui,0);context.paintNeeded=true;context.frame(1040);assert.equal(draws,2);}
});
test('Seeded terrain keeps all patches while reducing fill submissions by over ninety percent',()=>{
 const W=require('./world.js'),P=require('./projection.js'),A=require('./terrain-art.js'),map=W.withTerrain(823901);let fills=0,vertices=0;
 const ctx={beginPath(){},closePath(){},moveTo(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));vertices++;},lineTo(x,y){assert.ok(Number.isFinite(x)&&Number.isFinite(y));vertices++;},fill(){fills++;},stroke(){}};
 const tiles=A.paint(ctx,map,(x,y,z)=>P.project(x,y,z,map));assert.ok(tiles>60000);assert.ok(vertices>=tiles*4);assert.ok(fills<tiles/10);
});
console.log(count+' security and reliability checks passed.');
