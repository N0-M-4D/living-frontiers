(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.GroundDetail=api;
})(globalThis,function(){
  'use strict';
  const SPACING=65,CHUNK_SIZE=520,MAX_CHUNKS=512;

  function create(map,project){
    const chunks=new Map(),scale=map.SCALE||1,bounds=map.bounds;
    function build(cx,cy){
      const paths=[new Path2D(),new Path2D()];
      const left=cx*CHUNK_SIZE,top=cy*CHUNK_SIZE;
      for(let y=top;y<top+CHUNK_SIZE;y+=SPACING){
        for(let x=left;x<left+CHUNK_SIZE;x+=SPACING){
          if(x<bounds.minX||x>bounds.maxX||y<bounds.minY||y>bounds.maxY)continue;
          const h=Math.abs(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
          const px=x+h*50,py=y+h*37;
          if(!map.walkable(px,py))continue;
          const point=project(px,py),path=paths[h>.6?0:1];
          path.moveTo(point.x-2/scale,point.y);
          path.lineTo(point.x,point.y-3/scale);
          path.lineTo(point.x+2/scale,point.y);
        }
      }
      return paths;
    }
    function get(cx,cy){
      const key=cx+','+cy;
      let paths=chunks.get(key);
      if(paths)chunks.delete(key);
      else paths=build(cx,cy);
      chunks.set(key,paths);
      if(chunks.size>MAX_CHUNKS)chunks.delete(chunks.keys().next().value);
      return paths;
    }
    function draw(ctx,viewportCorners){
      if(!viewportCorners?.length||viewportCorners.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)))return;
      // The halo keeps boundary blades visible as the viewport crosses a chunk.
      const minX=Math.max(bounds.minX,Math.min(...viewportCorners.map(p=>p.x))-SPACING);
      const maxX=Math.min(bounds.maxX,Math.max(...viewportCorners.map(p=>p.x))+SPACING);
      const minY=Math.max(bounds.minY,Math.min(...viewportCorners.map(p=>p.y))-SPACING);
      const maxY=Math.min(bounds.maxY,Math.max(...viewportCorners.map(p=>p.y))+SPACING);
      if(minX>maxX||minY>maxY)return;
      const visible=[];
      for(let cy=Math.floor(minY/CHUNK_SIZE);cy<=Math.floor(maxY/CHUNK_SIZE);cy++){
        for(let cx=Math.floor(minX/CHUNK_SIZE);cx<=Math.floor(maxX/CHUNK_SIZE);cx++)visible.push(get(cx,cy));
      }
      ctx.lineWidth=.7/scale;
      for(let shade=0;shade<2;shade++){
        ctx.strokeStyle=shade===0?'#71866255':'#d8d1a655';
        for(const paths of visible)ctx.stroke(paths[shade]);
      }
    }
    return {draw,clear:()=>chunks.clear(),get cachedChunks(){return chunks.size;}};
  }
  return {create,CHUNK_SIZE,MAX_CHUNKS};
});
