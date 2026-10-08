/* Layered battlefield effects. Stateless particles derive from simulation ages;
   no particle arrays, per-frame sprite allocation, or effects outside player vision. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BattlefieldFX=api;})(globalThis,function(){
 'use strict';
 const TAU=Math.PI*2,LIMIT=40,MAX_PUFFS=240;
 const clamp=n=>Math.max(0,Math.min(1,n));
 function stages(age){return {flash:clamp(1-age/.16),fire:clamp(1-age/.5),dust:Math.sin(clamp(age)*Math.PI),smoke:clamp(age/.2)*clamp((1-age)/.4)};}
 function create(makeCanvas=()=>document.createElement('canvas')){
  const sprites=new Map();let framePuffs=0;
  for(const [name,inside,outside] of [['fire','#fff4bd','#c8491600'],['smoke','#4b4c44bd','#4b4c4400'],['dust','#baaa8175','#baaa8100'],['light','#fff1a699','#ffbd3600']]){
   const surface=makeCanvas();surface.width=96;surface.height=96;const c=surface.getContext('2d'),g=c.createRadialGradient(48,48,0,48,48,48);g.addColorStop(0,inside);g.addColorStop(name==='fire'?.27:.45,name==='fire'?'#ec8f31d9':inside);g.addColorStop(1,outside);c.fillStyle=g;c.fillRect(0,0,96,96);sprites.set(name,surface);
  }
  function puff(ctx,name,x,y,r,alpha,aspect=1){if(alpha<=0||r<=0||framePuffs>=MAX_PUFFS)return;framePuffs++;ctx.globalAlpha=alpha;ctx.drawImage(sprites.get(name),x-r,y-r*aspect,r*2,r*2*aspect);}
  function draw(ctx,state,{project,map,scale,visible,onScreen,reduced=false}){
   framePuffs=0;
   const s=map.SCALE||1,close=scale/s>.4,rich=close&&!reduced;let count=0;
   ctx.save();
   for(const shot of state.shots){
    if(count>=LIMIT||!visible(shot)||!visible({x:shot.tx,y:shot.ty})||(!onScreen(shot)&&!onScreen({x:shot.tx,y:shot.ty})))continue;count++;
    const t=clamp(1-shot.ttl/.42),a=project(shot.x,shot.y,map.height(shot.x,shot.y)+6),b=project(shot.tx,shot.ty,map.height(shot.tx,shot.ty)+4),f=Math.min(1,t*3),back=Math.max(0,f-.15);
    ctx.globalAlpha=(1-t)*.9;ctx.strokeStyle='#fff1bf';ctx.lineWidth=1.4/scale;ctx.beginPath();ctx.moveTo(a.x+(b.x-a.x)*back,a.y+(b.y-a.y)*back);ctx.lineTo(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f);ctx.stroke();
    if(rich&&t<.3)puff(ctx,'fire',a.x,a.y,7/s,(1-t/.3)*.8,.7);
   }
   let shellTrails=0;
   for(const shell of state.shells){
    const t=clamp(1-shell.remaining/shell.total),x=shell.x+(shell.tx-shell.x)*t,y=shell.y+(shell.ty-shell.y)*t;
    if(!visible({x,y})||!onScreen({x,y},160))continue;
    const h=map.height(x,y)+Math.sin(t*Math.PI)*240,p=project(x,y,h);
    if(rich&&t<.06&&visible(shell)){const origin=project(shell.x,shell.y,map.height(shell.x,shell.y)+12);puff(ctx,'fire',origin.x,origin.y,18/s,(1-t/.06)*.9);puff(ctx,'dust',origin.x,origin.y,28/s,(1-t/.06)*.5,.5);}
    if(rich&&shellTrails++<12){for(let i=1;i<=4;i++){const age=Math.max(0,t-i*.008),sx=shell.x+(shell.tx-shell.x)*age,sy=shell.y+(shell.ty-shell.y)*age,q=project(sx,sy,map.height(sx,sy)+Math.sin(age*Math.PI)*240);puff(ctx,'dust',q.x,q.y,(2+i*.65)/scale,.25);}}
    ctx.globalAlpha=1;ctx.fillStyle='#fff1ba';ctx.beginPath();ctx.arc(p.x,p.y,2/scale,0,TAU);ctx.fill();
   }
   count=0;
   for(const major of [true,false])for(const e of state.explosions){
    if((e.size>15)!==major)continue;
    if(count>=LIMIT||!visible(e)||!onScreen(e,180))continue;count++;
    const t=clamp(1-e.ttl/e.total),phase=stages(t),p=project(e.x,e.y),r=e.size/s,large=e.size>15;
    if(framePuffs>MAX_PUFFS-20){ctx.globalAlpha=phase.dust*.6;ctx.fillStyle='#a69773';ctx.beginPath();ctx.ellipse(p.x,p.y,r*(.5+t),r*(.25+t*.5),0,0,TAU);ctx.fill();continue;}
    if(!rich){puff(ctx,'dust',p.x,p.y,r*(.5+t),phase.dust*.65,.55);puff(ctx,'fire',p.x,p.y,r*.65,phase.fire*.8,.8);continue;}
    // Ground pressure, brief incandescent core, separate debris and rising smoke.
    puff(ctx,'light',p.x,p.y,r*2.5,phase.flash*.55,.5);
    for(let i=0;i<(large?7:3);i++){const a=i*2.399,spread=r*(.3+t*1.9),x=p.x+Math.cos(a)*spread,y=p.y+Math.sin(a)*spread*.45;puff(ctx,'dust',x,y,r*(.5+t*.5),phase.dust*.58,.55);}
    for(let i=0;i<(large?5:2);i++){const a=i*2.399;puff(ctx,'fire',p.x+Math.cos(a)*r*.3,p.y-Math.sin(t*Math.PI)*r*.5+Math.sin(a)*r*.2,r*(.4+t*.25),phase.fire*.8);}
    if(large){
     ctx.globalAlpha=phase.fire;ctx.strokeStyle='#eac389';ctx.lineWidth=1/scale;
     for(let i=0;i<10;i++){const a=i*2.399,reach=r*(.7+(i%3)*.3)*t*2.8,x=p.x+Math.cos(a)*reach,y=p.y+Math.sin(a)*reach*.5-Math.sin(t*Math.PI)*r;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x-Math.cos(a)*3/scale,y+3/scale);ctx.stroke();}
     for(let i=0;i<5;i++)puff(ctx,'smoke',p.x+(i-2)*r*.27+t*r*.5,p.y-r*(t*1.7+i*.12),r*(.4+t*.65),phase.smoke*.5);
    }
   }
   if(rich){let trails=0;for(const u of state.units){if(trails>=20||!u.moving||u.type==='infantry'||u.hp<=0||!visible(u)||!onScreen(u))continue;trails++;for(let i=0;i<3;i++){const t=(state.time*.7+i/3)%1,x=u.x-Math.cos(u.angle)*(18+t*60),y=u.y-Math.sin(u.angle)*(18+t*60),p=project(x,y);puff(ctx,'dust',p.x,p.y-t*5/s,(8+t*15)/s,(1-t)*.25,.6);}}
    let fires=0;for(const b of [...state.buildings,...state.wrecks]){if(fires>=16||!visible(b)||!onScreen(b)||b.hp>b.maxHp*.4)continue;if(b.hp===undefined&&!b.type)continue;fires++;const p=project(b.x,b.y),r=b.maxHp?12:5,phase=(state.time*.32+fires*.17)%1;puff(ctx,'fire',p.x,p.y-r/s,r/s,.6);puff(ctx,'smoke',p.x+phase*14/s,p.y-(8+phase*38)/s,(8+phase*15)/s,(1-phase)*.6);}}
   ctx.restore();
  }
  function crater(ctx,c,project,s){const p=project(c.x,c.y),r=c.size/s;ctx.save();ctx.fillStyle='#827456';ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.35,r*.7,0,0,TAU);ctx.fill();ctx.fillStyle='#393b2e';ctx.beginPath();ctx.ellipse(p.x,p.y-r*.05,r,r*.48,0,0,TAU);ctx.fill();ctx.strokeStyle='#c0ad7b';ctx.lineWidth=.65;ctx.beginPath();ctx.ellipse(p.x,p.y,r*1.1,r*.55,0,.15,2.8);ctx.stroke();ctx.restore();}
  return {draw,crater,get lastPuffs(){return framePuffs;},spriteBytes:sprites.size*96*96*4};
 }
 return {create,stages,LIMIT,MAX_PUFFS};
});
