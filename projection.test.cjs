const assert=require('node:assert/strict'),P=require('./projection.js'),G=require('./world.js');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function roundtrip(x,y,scale=1,offset={x:0,y:0}){
  const p=P.project(x,y,undefined,G),sx=p.x*scale+offset.x,sy=p.y*scale+offset.y;
  const world=P.unproject(sx,sy,scale,offset,G),again=P.project(world.x,world.y,undefined,G);
  // Multiple world points can project to one pixel on a folded bank; the visible
  // placement must still reproject to the requested pixel.
  assert.ok(Math.hypot(again.x*scale+offset.x-sx,again.y*scale+offset.y-sy)<.001,`Screen mismatch at ${x},${y}`);
  return world;
}
test('Known river-bank failure reprojects exactly across camera zoom and pan',()=>{
  for(const scale of [.15,.5,2.2*G.SCALE,3.2*G.SCALE])for(const offset of [{x:0,y:0},{x:-4823.5,y:943.2}])roundtrip(7970,2650,scale,offset);
});
test('Whole-country land grid has stable terrain intersections',()=>{
  for(let x=G.bounds.minX;x<G.bounds.maxX;x+=60)for(let y=G.bounds.minY;y<G.bounds.maxY;y+=60)if(G.land(x,y))roundtrip(x,y,3.2*G.SCALE);
});
test('Dense banks on both sides retain cursor alignment',()=>{
  for(let y=200*G.SCALE;y<3000*G.SCALE;y+=20)for(const side of [-1,1])for(const distance of [37,39.9,40.1,42,55,80,130])roundtrip(G.riverX(y)+side*distance*G.SCALE,y,3.2*G.SCALE,{x:241,y:-891});
});
test('Flat ground recovers the original world point, including negative elevation',()=>{
  for(const elevation of [-2,0,7,143]){
    const map={SCALE:G.SCALE,height:()=>elevation*G.SCALE},point={x:3456,y:7890},screen=P.project(point.x,point.y,undefined,map);
    const actual=P.unproject(screen.x*2-500,screen.y*2+100,2,{x:-500,y:100},map);
    assert.ok(Math.hypot(actual.x-point.x,actual.y-point.y)<.00001);
  }
});
test('Explicit object elevation remains separate from terrain height',()=>{
  const base=P.project(3000,3500,0,G),raised=P.project(3000,3500,100,G);
  assert.equal(base.x,raised.x);assert.ok(Math.abs(base.y-raised.y-100/G.SCALE)<1e-10);
});
console.log(count+' projection checks passed.');
