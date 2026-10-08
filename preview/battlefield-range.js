(() => {
 'use strict';
 const $=id=>document.getElementById(id),canvas=$('range'),ctx=canvas.getContext('2d'),map=World.withTerrain(823901),S=map.SCALE;
 const project=(x,y,z)=>Projection.project(x,y,z,map),terrain=GroundDetail.create(map,project),models=FrontierModels.createRenderer(),fx=BattlefieldFX.create();
 const overview=document.createElement('canvas');overview.width=1600;overview.height=900;const base=overview.getContext('2d');base.scale(.25,.25);TerrainArt.paint(base,map,project);
 const centre={x:3220,y:3310},props=[];let width=1280,height=600,scale=3.5,offset={},pending=true,playing=false,last=0,time=3.6;
 for(let i=0;i<7;i++)props.push({type:i===3?'warehouse':'house',x:2990+i*64,y:3120,angle:i%2?Math.PI:0});
 for(let i=0;i<4;i++)props.push({type:'house',x:3340+i*70,y:3260,angle:Math.PI});
 props.push({type:'battery',x:3020,y:3540,angle:-.6},{type:'trench',x:3320,y:3410,angle:.15});
 for(let i=0;i<36;i++){const x=2740+(i*173)%1100,y=2900+(i*217)%900;if(map.terrain(x,y)==='forest'||i%3===0)props.push({type:i%3?'tree':'pine',x,y,angle:0});}
 function resize(){width=canvas.clientWidth;height=canvas.clientHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const p=project(centre.x,centre.y);offset={x:width/2-p.x*scale,y:height/2-p.y*scale};pending=true;}
 function draw(){
  const start=performance.now(),dpr=Math.min(devicePixelRatio||1,1.5);models.beginFrame(scale/S*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#a5b393';ctx.fillRect(0,0,width,height);ctx.save();ctx.translate(offset.x,offset.y);ctx.scale(scale,scale);ctx.drawImage(overview,0,0,6400,3600);
  const corners=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>Projection.unproject(x,y,scale,offset,map));pending=terrain.draw(ctx,corners,scale,dpr);
  const road=[{x:2800,y:3210},{x:3100,y:3210},{x:3500,y:3230},{x:3800,y:3340}];
  for(const [color,w] of [['#6a715655',17],['#928f71',12],['#beb394',8]]){ctx.beginPath();road.forEach((r,i)=>{const p=project(r.x,r.y);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.lineWidth=w/S;ctx.strokeStyle=color;ctx.stroke();}
  const state={time,shots:[],shells:[],explosions:[],craters:[],buildings:[],wrecks:[],units:[]};
  for(let i=0;i<3;i++){const total=3+i*.22,target={x:3340+i*43,y:3310+i*17};if(time<total)state.shells.push({x:3020,y:3540,tx:target.x,ty:target.y,total,remaining:total-time});else{const age=time-total;if(age<1.7)state.explosions.push({...target,size:85,total:1.7,ttl:1.7-age});fx.crater(ctx,{...target,size:18},project,S);}}
  const objects=props.map(p=>({...p}));
  for(let i=0;i<6;i++){const u={type:'tank',x:3090+(i%2)*35+time*7,y:3290+Math.floor(i/2)*34,angle:0,side:'blue',hp:100,moving:playing};objects.push(u);state.units.push(u);}
  for(let i=0;i<20;i++)objects.push({type:'infantry',x:3150+(i%5)*13,y:3430+Math.floor(i/5)*13,angle:-.5});
  objects.sort((a,b)=>a.x+a.y-b.x-b.y);for(const o of objects){const p=project(o.x,o.y);models.draw(ctx,o.type,p.x,p.y,1/S,{side:o.side||'neutral',angle:o.angle,detail:true});}
  fx.draw(ctx,state,{project,map,scale,visible:()=>true,onScreen:()=>true,reduced:$('quality').value==='reduced'});ctx.restore();
  pending=models.needsRefinement||pending;const t=terrain.stats();$('stats').textContent=(t.bytes/1048576).toFixed(1)+' MiB terrain / '+t.entries+' tiles · '+(performance.now()-start).toFixed(1)+' ms draw';
 }
 function frame(now){const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(!document.hidden){if(playing){time=Math.min(6,time+dt);$('phase').value=time;if(time===6)playing=false;pending=true;}if(pending)draw();}requestAnimationFrame(frame);}
 $('phase').oninput=()=>{time=Number($('phase').value);playing=false;pending=true;};$('fire').onclick=()=>{time=0;playing=true;pending=true;};$('zoom').onchange=()=>{scale=Number($('zoom').value);resize();};$('quality').onchange=()=>{pending=true;};new ResizeObserver(resize).observe(canvas);resize();requestAnimationFrame(frame);
})();
