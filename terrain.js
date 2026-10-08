/* Seeded gradient noise and campaign height fields. No noise work in the frame loop.
   Algorithm reference: Ken Perlin, https://cs.nyu.edu/~perlin/noise/ */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TerrainField=api;})(globalThis,function(){
  'use strict';
  const STEP=20,COLS=233,ROWS=166,MAX_HEIGHT=260,SLOPE_LIMIT=.27;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
  function randomSeed(){return (globalThis.crypto?.getRandomValues?globalThis.crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*4294967296))>>>0;}
  function perlin(seed){
    let value=seed>>>0;
    const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
    const permutation=Array.from({length:256},(_,i)=>i);
    for(let i=255;i>0;i--){const j=Math.floor(random()*(i+1));[permutation[i],permutation[j]]=[permutation[j],permutation[i]];}
    const p=new Uint16Array(512);for(let i=0;i<512;i++)p[i]=permutation[i&255];
    const gradients=[[1,0],[-1,0],[0,1],[0,-1],[.7071,.7071],[-.7071,.7071],[.7071,-.7071],[-.7071,-.7071]];
    const fade=t=>t*t*t*(t*(t*6-15)+10),lerp=(a,b,t)=>a+(b-a)*t;
    return (x,y)=>{
      const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy,u=fade(fx),v=fade(fy);
      const dot=(dx,dy)=>{const g=gradients[p[p[(ix+dx)&255]+((iy+dy)&255)]&7];return g[0]*(fx-dx)+g[1]*(fy-dy);};
      return lerp(lerp(dot(0,0),dot(1,0),u),lerp(dot(0,1),dot(1,1),u),v);
    };
  }
  function create(map,seed){
    const noise=perlin(seed),s=map.SCALE||1,heights=new Float32Array(COLS*ROWS),types=new Uint8Array(COLS*ROWS);
    const coast=map.coast.map(([x,y])=>[x/s,y/s]);
    const names=['open','forest','hill','ridge','valley','marsh'];
    function shoreDistance(x,y){let distance=Infinity;for(let i=0;i<coast.length;i++){
      const a=coast[i],b=coast[(i+1)%coast.length],dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy));
      distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy));
    }return distance;}
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const px=x*STEP,py=y*STEP,i=y*COLS+x;
      if(!map.land(px*s,py*s)){heights[i]=2;continue;}
      const warpX=px+noise(px/950+13,py/950-8)*180,warpY=py+noise(px/950-19,py/950+26)*180;
      const mass=clamp(.5+noise(warpX/1300+17,warpY/1100+7),.12,1);
      const ridge=Math.pow(1-Math.abs(noise(warpX/580+31,warpY/780+45))*1.7,3);
      const rolling=noise(px/420+71,py/480+11)*35+noise(px/180-20,py/180+21)*8;
      const raw=30+mass*220*clamp(ridge)+rolling;
      const river=Math.abs(px-map.riverX(py*s)/s);
      const coastBlend=smooth(shoreDistance(px,py)/200),riverBlend=smooth((river-45)/270);
      heights[i]=2+clamp(raw,5,MAX_HEIGHT-2)*coastBlend*riverBlend;
    }
    // Town centres and opening formations get usable, gently blended terraces.
    for(const r of map.regions){const x=r.x/s,y=r.y/s,target=at(x,y);
      for(let gy=Math.max(0,Math.floor((y-140)/STEP));gy<Math.min(ROWS,Math.ceil((y+140)/STEP));gy++)for(let gx=Math.max(0,Math.floor((x-140)/STEP));gx<Math.min(COLS,Math.ceil((x+140)/STEP));gx++){
        const d=Math.hypot(gx*STEP-x,gy*STEP-y),blend=1-smooth((d-70)/70),i=gy*COLS+gx;
        // Never raise the river or sea to make a town terrace.
        if(heights[i]>3)heights[i]+=(target-heights[i])*blend;
      }
    }
    // Bound each axis slope. Bilinear derivatives then satisfy |hx+hy| < .84,
    // so the isometric surface cannot fold over and break cursor picking.
    const limit=STEP*SLOPE_LIMIT;
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const i=y*COLS+x;if(x)heights[i]=Math.min(heights[i],heights[i-1]+limit);if(y)heights[i]=Math.min(heights[i],heights[i-COLS]+limit);}
    for(let y=ROWS-1;y>=0;y--)for(let x=COLS-1;x>=0;x--){const i=y*COLS+x;if(x+1<COLS)heights[i]=Math.min(heights[i],heights[i+1]+limit);if(y+1<ROWS)heights[i]=Math.min(heights[i],heights[i+COLS]+limit);}
    function at(x,y){
      const gx=clamp(x/STEP,0,COLS-1.000001),gy=clamp(y/STEP,0,ROWS-1.000001),ix=Math.floor(gx),iy=Math.floor(gy),u=gx-ix,v=gy-iy,i=iy*COLS+ix;
      return (heights[i]*(1-u)+heights[i+1]*u)*(1-v)+(heights[i+COLS]*(1-u)+heights[i+COLS+1]*u)*v;
    }
    function gradient(x,y){const d=STEP;return {x:(at(x+d,y)-at(x-d,y))/(2*d),y:(at(x,y+d)-at(x,y-d))/(2*d)};}
    for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
      const px=x*STEP,py=y*STEP,h=at(px,py),surround=(at(px-140,py)+at(px+140,py)+at(px,py-140)+at(px,py+140))/4;
      const g=gradient(px,py),slope=Math.hypot(g.x,g.y),river=Math.abs(px-map.riverX(py*s)/s);
      types[y*COLS+x]=h>65&&h-surround>5?3:h<surround-6?4:noise(px/240+9,py/250-12)>.04&&h<155?1:h>80||slope>.14?2:river<140&&h<18?5:0;
    }
    function height(x,y){return at(x/s,y/s)*s;}
    function terrain(x,y){if(!map.walkable(x,y))return 'water';const gx=Math.round(clamp(x/s/STEP,0,COLS-1)),gy=Math.round(clamp(y/s/STEP,0,ROWS-1));return names[types[gy*COLS+gx]];}
    function lineOfFire(a,b){
      const length=Math.hypot(b.x-a.x,b.y-a.y),n=Math.max(1,Math.ceil(length/(10*s))),from=height(a.x,a.y)+6,to=height(b.x,b.y)+6;
      for(let i=1;i<n;i++){const t=i/n;if(height(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)>from+(to-from)*t+1)return false;}
      return true;
    }
    return {seed:seed>>>0,height,terrain,lineOfFire,gradient:(x,y)=>gradient(x/s,y/s),slope:(x,y)=>{const g=gradient(x/s,y/s);return Math.hypot(g.x,g.y);},heightBounds:{min:0,max:MAX_HEIGHT*s},bytes:heights.byteLength+types.byteLength};
  }
  return {create,perlin,randomSeed,STEP,SLOPE_LIMIT};
});
