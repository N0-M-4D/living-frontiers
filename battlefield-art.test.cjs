const test=require('node:test'),assert=require('node:assert/strict');
const Ground=require('./ground-detail.js'),FX=require('./battlefield-fx.js'),W=require('./world.js'),P=require('./projection.js');
function context(){return {draws:0,save(){},restore(){},setTransform(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},clip(){},fill(){},stroke(){},fillRect(){},ellipse(...v){assert.ok(v.every(Number.isFinite));},arc(...v){assert.ok(v.every(Number.isFinite));},drawImage(...args){this.draws++;assert.ok(args.slice(1).every(Number.isFinite));},createRadialGradient(){return {addColorStop(){}};}};}
const factory=()=>({width:0,height:0,getContext:()=>context()});
test('Close terrain resolution follows screen density and never exceeds the supported zoom budget',()=>{
 for(const zoom of [1,1.8,3,6.96,10.1])assert.ok(Ground.resolution(zoom,1.5)>=zoom*1.5);
 assert.equal(Ground.resolution(100,3),16);
});
test('Visible tiles bake incrementally, reuse stationary views and remain byte bounded across travel',()=>{
 const map=W.withTerrain(823901),project=(x,y)=>P.project(x,y,undefined,map),g=Ground.create(map,project,factory),ctx=context();
 const corners=(x,y)=>[{x,y},{x:x+300,y},{x,y:y+300},{x:x+300,y:y+300}];
 let pending=true,n=0;
 while(pending&&n++<100){const before=g.stats().builds;pending=g.draw(ctx,corners(3000,3800),6.96,1.5);assert.ok(g.stats().builds-before<=2);assert.ok(g.stats().bytes<=Ground.MAX_BYTES);}
 assert.ok(n<100,'paused view must finish building');const built=g.stats().builds;g.draw(ctx,corners(3000,3800),6.96,1.5);assert.equal(g.stats().builds,built);
 for(let i=0;i<60;i++){g.draw(ctx,corners(2000+i*100,3000+i*50),6.96,1.5);assert.ok(g.stats().bytes<=Ground.MAX_BYTES);assert.ok(g.cachedChunks<=Ground.MAX_CHUNKS);}
 g.clear();assert.equal(g.stats().bytes,0);assert.equal(g.cachedChunks,0);
});
test('Overview and invalid viewports do not allocate high detail tiles',()=>{
 const map=W.withTerrain(94),g=Ground.create(map,(x,y)=>({x,y}),factory),ctx=context();
 for(const corners of [[],[{x:NaN,y:0}],[{x:0,y:0}]])g.draw(ctx,corners,.4,1);assert.equal(g.stats().builds,0);
});
test('Battle effects are vision gated and capped; repeated frames allocate no new sprites',()=>{
 let allocated=0;const fx=FX.create(()=>{allocated++;return factory();}),ctx=context();
 const explosion={x:100,y:100,ttl:.9,total:1.7,size:85},state={shots:[],shells:[],explosions:Array(500).fill(explosion),units:[],buildings:[],wrecks:[],time:1};
 const opts={project:(x,y,z=0)=>({x,y:y-z}),map:{SCALE:3,height:()=>0},scale:7,visible:()=>false,onScreen:()=>true};
 fx.draw(ctx,state,opts);assert.equal(ctx.draws,0);
 opts.visible=()=>true;fx.draw(ctx,state,opts);const full=ctx.draws;assert.ok(full>0);assert.ok(fx.lastPuffs<=FX.MAX_PUFFS);ctx.draws=0;fx.draw(ctx,{...state,explosions:state.explosions.slice(0,FX.LIMIT)},opts);assert.equal(ctx.draws,full);
 ctx.draws=0;fx.draw(ctx,state,{...opts,reduced:true});assert.ok(ctx.draws<full);assert.equal(allocated,4);assert.ok(fx.spriteBytes<160000);
});
test('Explosion phases separate the initial flash from dissipating smoke',()=>{
 assert.equal(FX.stages(0).flash,1);assert.equal(FX.stages(.5).flash,0);assert.ok(FX.stages(.5).smoke>0);for(const v of Object.values(FX.stages(1)))assert.ok(v<1e-10);
});

test('Camera movement never bakes terrain and reuses a cached zoom level',()=>{
 const map=W.withTerrain(823901),project=(x,y)=>P.project(x,y,undefined,map),g=Ground.create(map,project,factory),ctx=context();
 const corners=[{x:3000,y:3800},{x:3300,y:3800},{x:3000,y:4100},{x:3300,y:4100}];
 assert.equal(g.draw(ctx,corners,2,1,{moving:true}),true);assert.equal(g.stats().builds,0);
 for(let i=0;i<100&&g.draw(ctx,corners,2,1);i++);const built=g.stats().builds;ctx.draws=0;
 g.draw(ctx,corners,7,1.5,{moving:true});assert.equal(g.stats().builds,built);assert.ok(ctx.draws>0,'cached terrain should stay visible during zoom');
 g.draw(ctx,corners,7,1.5);assert.equal(g.stats().builds,built+1,'settled terrain refines one tile per frame');
});
