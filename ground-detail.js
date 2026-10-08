/* Camera-local terrain tiles with a strict pixel budget. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./terrain-art.js'):root.TerrainArt);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.GroundDetail=api;
})(globalThis,function(art){
  'use strict';
  const CHUNK_SIZE=256,MAX_CHUNKS=256,MAX_BYTES=64*1024*1024,STEP=16;
  const hash=(x,y)=>{let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
  function resolution(zoom,dpr){return [1,1.5,2,3,4,6,8,12,16].find(n=>n>=zoom*dpr)||16;}
  function create(map,project,makeCanvas=()=>document.createElement('canvas')){
    const chunks=new Map(),s=map.SCALE||1,bounds=map.bounds;let bytes=0,builds=0;
    function bake(cx,cy,density){
      const x0=cx*CHUNK_SIZE,y0=cy*CHUNK_SIZE,patches=[],edge=[];
      for(let i=0;i<=CHUNK_SIZE;i+=STEP)edge.push(project(x0+i,y0));
      for(let i=STEP;i<=CHUNK_SIZE;i+=STEP)edge.push(project(x0+CHUNK_SIZE,y0+i));
      for(let i=CHUNK_SIZE-STEP;i>=0;i-=STEP)edge.push(project(x0+i,y0+CHUNK_SIZE));
      for(let i=CHUNK_SIZE-STEP;i>0;i-=STEP)edge.push(project(x0,y0+i));
      const minX=Math.min(...edge.map(p=>p.x))-1,minY=Math.min(...edge.map(p=>p.y))-1,maxX=Math.max(...edge.map(p=>p.x))+1,maxY=Math.max(...edge.map(p=>p.y))+1;
      const surface=makeCanvas();surface.width=Math.ceil((maxX-minX)*density);surface.height=Math.ceil((maxY-minY)*density);
      const ctx=surface.getContext('2d');ctx.setTransform(density,0,0,density,-minX*density,-minY*density);
      function polygon(points,fill){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();if(fill){ctx.fillStyle=fill;ctx.fill();}}
      polygon(edge);ctx.clip();
      for(let y=y0;y<y0+CHUNK_SIZE;y+=STEP)for(let x=x0;x<x0+CHUNK_SIZE;x+=STEP){
        if(!map.walkable(x+STEP/2,y+STEP/2))continue;
        const points=[[x,y],[x+STEP,y],[x+STEP,y+STEP],[x,y+STEP]].map(([x,y])=>project(x,y));
        const fill=art.color(map,x+STEP/2,y+STEP/2,true);patches.push({x,y});polygon(points,fill);ctx.strokeStyle=fill;ctx.lineWidth=.55;ctx.stroke();
      }
      for(const {x,y} of patches){
        const n=hash(x,y),px=x+n*STEP,py=y+hash(y,x)*STEP,p=project(px,py),type=map.terrain(px,py),rock=type==='ridge'||(map.slope?.(px,py)||0)>.2;
        ctx.fillStyle=rock?'#77766845':type==='forest'?'#344d3333':type==='marsh'?'#556e6630':'#c5bd8935';
        ctx.beginPath();ctx.ellipse(p.x,p.y,(rock?3:2)/s,(rock?1.2:.6)/s,n*2,0,Math.PI*2);ctx.fill();
        // Fine flecks break up flat colour without enlarging the country image.
        for(let i=0;i<3;i++){const a=hash(x+i*31,y+7),b=hash(y+i*17,x+3),q=project(x+a*STEP,y+b*STEP);ctx.fillStyle=i===0?'#e4dbad20':'#233e2920';ctx.fillRect(q.x,q.y,(.35+a*.65)/s,.3/s);}
        if(n>.45){ctx.strokeStyle=rock?'#ddd5ba75':'#334d3540';ctx.lineWidth=.45/s;ctx.beginPath();ctx.moveTo(p.x-1.8/s,p.y);ctx.lineTo(p.x,p.y-(rock?.2:2.3)/s);ctx.lineTo(p.x+1/s,p.y-.3/s);ctx.stroke();}
      }
      builds++;return {surface,x:minX,y:minY,w:surface.width/density,h:surface.height/density,bytes:surface.width*surface.height*4};
    }
    function draw(ctx,corners,zoom=2,dpr=1,{moving=false}={}){
      if(zoom<1||!corners?.length||corners.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return false;
      const minX=Math.max(bounds.minX,Math.min(...corners.map(p=>p.x))-32),maxX=Math.min(bounds.maxX,Math.max(...corners.map(p=>p.x))+32);
      const minY=Math.max(bounds.minY,Math.min(...corners.map(p=>p.y))-32),maxY=Math.min(bounds.maxY,Math.max(...corners.map(p=>p.y))+32);
      const density=resolution(zoom,dpr),wanted=[],cx=(minX+maxX)/2,cy=(minY+maxY)/2,view=corners.map(p=>project(p.x,p.y));
      const left=Math.min(...view.map(p=>p.x)),right=Math.max(...view.map(p=>p.x)),top=Math.min(...view.map(p=>p.y)),bottom=Math.max(...view.map(p=>p.y));
      for(let y=Math.floor(minY/CHUNK_SIZE);y<=Math.floor(maxY/CHUNK_SIZE);y++)for(let x=Math.floor(minX/CHUNK_SIZE);x<=Math.floor(maxX/CHUNK_SIZE);x++){
        const p=project((x+.5)*CHUNK_SIZE,(y+.5)*CHUNK_SIZE),m=CHUNK_SIZE*1.3/s;
        if(p.x+m<left||p.x-m>right||p.y+m<top||p.y-m>bottom)continue;
        wanted.push({x,y,key:x+','+y+','+density,distance:Math.hypot((x+.5)*CHUNK_SIZE-cx,(y+.5)*CHUNK_SIZE-cy)});
      }
      wanted.sort((a,b)=>a.distance-b.distance);const protectedKeys=new Set(wanted.map(t=>t.key));let pending=false,built=0;
      ctx.save();ctx.globalAlpha=Math.min(1,(zoom-1)/.65);
      for(const tile of wanted){
        let item=chunks.get(tile.key);
        if(!item){
          if(moving||built>=1){pending=true;
            // Reuse the best existing resolution during camera movement; never bake intermediate zoom levels.
            let fallback=null;for(const level of [16,12,8,6,4,3,2,1.5,1]){fallback=chunks.get(tile.x+','+tile.y+','+level);if(fallback)break;}
            if(fallback)ctx.drawImage(fallback.surface,fallback.x,fallback.y,fallback.w,fallback.h);
            continue;
          }
          const reserve=Math.ceil(CHUNK_SIZE*1.7/s*density+4)*Math.ceil(CHUNK_SIZE*1.4/s*density+4)*4;
          for(const [key,old] of chunks){if(bytes+reserve<=MAX_BYTES&&chunks.size<MAX_CHUNKS)break;if(!protectedKeys.has(key)){bytes-=old.bytes;chunks.delete(key);}}
          if(bytes+reserve>MAX_BYTES||chunks.size>=MAX_CHUNKS)continue;
          item=bake(tile.x,tile.y,density);built++;chunks.set(tile.key,item);bytes+=item.bytes;
        }else{chunks.delete(tile.key);chunks.set(tile.key,item);}
        ctx.drawImage(item.surface,item.x,item.y,item.w,item.h);
      }
      ctx.restore();return pending;
    }
    return {draw,clear(){chunks.clear();bytes=0;},stats:()=>({bytes,builds,entries:chunks.size,maxBytes:MAX_BYTES}),get cachedChunks(){return chunks.size;}};
  }
  return {create,resolution,CHUNK_SIZE,MAX_CHUNKS,MAX_BYTES};
});
