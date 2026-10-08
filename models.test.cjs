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
  for(let h=20;h<200;h++){r.draw(context,'tree',0,0,1,{h});assert.ok(r.stats().bytes<=r.stats().maxBytes);assert.ok(r.stats().entries<=160);}
  assert.ok(r.stats().entries<180);r.clear();assert.equal(r.stats().bytes,0);assert.equal(r.stats().entries,0);
});
console.log(checks+' model checks passed.');
