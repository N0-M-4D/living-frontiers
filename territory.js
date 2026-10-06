(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Territory=api;})(globalThis,function(){
  'use strict';
  const SIZE=80,RADIUS=360,TOWN_RADIUS=200,REQUIRED=.35,HOLD_SECONDS=8;
  function create(state,map){const cells=[],size=map.occupationCell||SIZE,radius=map.influenceRadius||RADIUS,bounds=map.bounds||{minX:240,minY:160,maxX:4480,maxY:3120};for(let y=Math.floor(bounds.minY/size)*size;y<bounds.maxY;y+=size)for(let x=Math.floor(bounds.minX/size)*size;x<bounds.maxX;x+=size){const candidates=[[x+size/2,y+size/2],[x+1,y+1],[x+size-1,y+1],[x+1,y+size-1],[x+size-1,y+size-1]],point=candidates.find(([px,py])=>map.walkable(px,py));if(!point)continue;const [px,py]=point,r=map.regionAt(px,py),owner=r.owner;cells.push({x,y,px,py,region:r.id,owner,value:owner==='blue'?1:owner==='red'?-1:0,contested:false});}return {cells,size,radius,clock:0,revision:0};}
  // Geometry is static; cache exact-position footprints without changing influence rules.
  const caches=new WeakMap();
  function cacheFor(t){let cache=caches.get(t);if(cache)return cache;cache={grid:new Map(),units:new WeakMap(),regions:new Map(),blue:new Float64Array(t.cells.length),red:new Float64Array(t.cells.length),invaders:new Float64Array(t.cells.length)};t.cells.forEach((c,i)=>{cache.grid.set(Math.floor(c.x/t.size)+','+Math.floor(c.y/t.size),i);if(!cache.regions.has(c.region))cache.regions.set(c.region,[]);cache.regions.get(c.region).push(c);});caches.set(t,cache);return cache;}
  function footprint(cache,t,u,map){let old=cache.units.get(u);const version=map.revision?.()||'';if(old&&old.x===u.x&&old.y===u.y&&old.version===version)return old.points;const points=[],radius=t.radius,size=t.size;
    for(let gy=Math.floor((u.y-radius)/size)-1;gy<=Math.floor((u.y+radius)/size);gy++)for(let gx=Math.floor((u.x-radius)/size)-1;gx<=Math.floor((u.x+radius)/size);gx++){const i=cache.grid.get(gx+','+gy);if(i===undefined)continue;const c=t.cells[i],dx=u.x-c.px,dy=u.y-c.py;if(dx*dx+dy*dy>radius*radius)continue;const d=Math.hypot(dx,dy);if(map.visible(u,{x:c.px,y:c.py}))points.push({i,weight:1-d/(radius*1.4)});}
    cache.units.set(u,{x:u.x,y:u.y,version,points});return points;
  }
  function step(state,dt){const t=state.territory;t.clock+=dt;if(t.clock<.25)return;const elapsed=t.clock;t.clock=0;const alive=state.units.filter(u=>u.hp>0);
    const cache=cacheFor(t);cache.blue.fill(0);cache.red.fill(0);cache.invaders.fill(0);let changed=false;
    for(const u of alive){const power=.4+.6*u.hp/u.maxHp,target=u.side==='blue'?cache.blue:cache.red;for(const point of footprint(cache,t,u,state.map)){target[point.i]+=power*point.weight;if(u.side==='red'&&!u.militia)cache.invaders[point.i]+=power*point.weight;}}
    for(let i=0;i<t.cells.length;i++){const cell=t.cells[i],blue=cache.blue[i],red=cache.red[i],previous=cell.owner,contested=blue>0&&red>0;if(contested!==cell.contested)changed=true;cell.contested=contested;
      if(!contested&&(blue||cache.invaders[i])){cell.value=Math.max(-1,Math.min(1,cell.value+(blue?1:-1)*elapsed*.4*Math.min(2,blue||red)));if(cell.value>=.65)cell.owner='blue';else if(cell.value<=-.65)cell.owner='red';}if(previous!==cell.owner)changed=true;
    }
    for(const r of state.regions){const cells=cache.regions.get(r.id),f=r.factory;r.ground={blue:cells.filter(c=>c.owner==='blue').length/cells.length,red:cells.filter(c=>c.owner==='red').length/cells.length};const nearby=alive.filter(u=>Math.hypot(u.x-f.x,u.y-f.y)<=TOWN_RADIUS),blue=nearby.some(u=>u.side==='blue'),red=nearby.some(u=>u.side==='red');
      const side=blue&&!red?'blue':red&&!blue&&nearby.some(u=>u.side==='red'&&!u.militia)?'red':null;
      if(side&&side!==f.owner&&r.ground[side]>=REQUIRED){if(r.capturing!==side){r.capturing=side;f.capture=0;}f.capture=Math.min(100,f.capture+elapsed*100/HOLD_SECONDS);r.captureStatus=(side==='blue'?'Capturing':'Enemy capturing')+' town';if(f.capture>=100){f.owner=side;r.owner=side;r.capturing=null;r.captureStatus=side==='blue'?'Region secured':'Enemy control';}}
      else {if(r.capturing){f.capture=0;r.capturing=null;}r.captureStatus=blue&&red?'Contested · clear the marked town zone':side&&side!==f.owner?'Hold 35% of ground · keep advancing':f.owner==='blue'?'Region secured':!blue?'Move troops into the marked town zone':'Hold the town';}
    }if(changed)t.revision++;
  }
  return {SIZE,RADIUS,TOWN_RADIUS,REQUIRED,HOLD_SECONDS,create,step};
});
