const assert=require('node:assert/strict');
const M=require('./models.js');
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
const context={setTransform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},drawImage(...args){assert.ok(args.slice(1).every(Number.isFinite));}};
const makeCanvas=()=>({width:0,height:0,getContext:()=>context});

test('Every asset produces finite, nonempty geometry through all four quadrants',()=>{
  for(const item of M.catalogue)for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const detail of [false,true]){
    const mesh=M.createMesh(item.id,{angle,detail});
    assert.ok(mesh.length>0,item.id);
    for(const face of mesh){assert.ok(face.points.length>=3);assert.ok(face.points.flat().every(Number.isFinite),item.id);}
    const b=M.bounds(mesh);assert.ok(b.maxX>b.minX&&b.maxY>b.minY,item.id);
  }
});
test('Construction and destroyed structures are visually distinct from operational structures',()=>{
  for(const type of ['battery','barracks','garage','supply','industry','refinery','hq']){
    const intact=JSON.stringify(M.createMesh(type));
    for(const state of ['damaged','ruined','construction'])assert.notEqual(JSON.stringify(M.createMesh(type,{state})),intact,type+' '+state);
  }
});
test('Bridge destruction removes centre decking and artillery wrecks break their barrels',()=>{
  assert.ok(M.createMesh('bridge',{state:'ruined'}).length<M.createMesh('bridge').length);
  assert.notDeepEqual(M.bounds(M.createMesh('artillery')),M.bounds(M.createMesh('artillery',{state:'ruined'})));
});
test('Cached draws reuse geometry across world positions and zoom scales',()=>{
  const r=M.createRenderer(makeCanvas);r.draw(context,'tank',0,0,1);r.draw(context,'tank',240,130,3);
  assert.equal(r.stats().misses,1);assert.equal(r.stats().hits,1);
});
test('Trench orientation preserves exact placement angles instead of unit-heading quantisation',()=>{
  const r=M.createRenderer(makeCanvas);r.draw(context,'trench',0,0,1,{angle:Math.PI/12});r.draw(context,'trench',0,0,1,{angle:Math.PI/16});
  assert.equal(r.stats().entries,2);
});
test('Facing, faction, condition and detail invalidate the sprite independently',()=>{
  const r=M.createRenderer(makeCanvas);
  for(const opts of [{},{angle:Math.PI},{side:'red'},{state:'ruined'},{detail:false},{turret:Math.PI/2}])r.draw(context,'tank',0,0,1,opts);
  assert.equal(r.stats().entries,6);
});
test('Sprite eviction bounds both retained pixel bytes and entry count',()=>{
  const r=M.createRenderer(makeCanvas);
  for(let h=20;h<200;h++){r.draw(context,'tree',0,0,1,{h});assert.ok(r.stats().bytes<=r.stats().maxBytes);assert.ok(r.stats().entries<=r.stats().maxEntries);}
  assert.ok(r.stats().entries<180);r.clear();assert.equal(r.stats().bytes,0);assert.equal(r.stats().entries,0);
});

test('A region-sized sprite working set stays cached at its actual screen density',()=>{
 const r=M.createRenderer(makeCanvas),scene=Array.from({length:90},(_,i)=>({w:24+i%7*4,d:24+i%5*4,h:16+i%9*4,side:'neutral',detail:true,angle:i%2?Math.PI:0}));
 let pending=true,frames=0;
 while(pending&&frames++<200){r.beginFrame(.5);const before=r.stats().misses;for(const o of scene)r.draw(context,'house',0,0,1,o);assert.ok(r.stats().misses-before<=2);pending=r.needsRefinement;}
 assert.ok(frames<200,'stationary art refinement must finish');assert.ok(r.stats().bytes<2*1024*1024);
 const before=r.stats().misses;for(let i=0;i<3;i++){r.beginFrame(.5,{moving:true});for(const o of scene)r.draw(context,'house',i*20,0,1,o);}assert.equal(r.stats().misses,before,'pan must not rebuild the working set');
});
test('Zoom reuses sprites in motion and restores their sharpness after settling',()=>{
 const r=M.createRenderer(makeCanvas);r.beginFrame(.5);r.draw(context,'house',0,0,1);const coarse=r.stats();
 r.beginFrame(4,{moving:true});r.draw(context,'house',0,0,1);assert.equal(r.stats().misses,coarse.misses);assert.ok(r.needsRefinement);
 r.beginFrame(4);r.draw(context,'house',0,0,1);assert.equal(r.stats().misses,coarse.misses+1);assert.ok(r.stats().bytes>coarse.bytes*20);
 r.beginFrame(4);r.draw(context,'house',0,0,1);assert.equal(r.needsRefinement,false);
});

console.log(checks+' model checks passed.');
