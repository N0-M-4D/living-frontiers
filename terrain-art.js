/* Static terrain illustration shared by the campaign and visual study. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TerrainArt=api;})(globalThis,function(){
  'use strict';
  function paint(ctx,map,project){
    const s=map.SCALE,step=12*s,contours=new Map();
    const color=(x,y)=>{
      const z=map.height(x,y)/s,g=map.gradient?.(x,y)||{x:0,y:0},slope=Math.hypot(g.x,g.y);
      // One fixed light direction makes slopes readable at every zoom.
      const light=Math.max(-.28,Math.min(.28,(-g.x*.6-g.y*.8)*1.05));
      let hue=83,sat=21,l=48+light*53;
      hue+=Math.max(0,1-z/65)*8;
      l-=Math.max(0,1-z/35)*4;
      if(z>100){const rock=Math.min(1,(z-100)/100+slope*.4);hue=83-rock*21;sat-=rock*12;l+=rock*8;}
      return `hsl(${hue.toFixed(1)} ${sat.toFixed(1)}% ${l.toFixed(1)}%)`;
    };
    function polygon(points,fill){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=fill;ctx.lineWidth=1.4;ctx.stroke();}
    // Ordered back to front, although bounded slopes also keep projection single-valued.
    const tiles=[];
    for(let y=80*s;y<3220*s;y+=step)for(let x=160*s;x<4560*s;x+=step){
      if(!map.land(x+step/2,y+step/2))continue;
      const world=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]],heights=world.map(([x,y])=>map.height(x,y)/s);
      tiles.push({x,y,points:world.map(([x,y])=>project(x,y)),heights,world});
    }
    tiles.sort((a,b)=>a.x+a.y-b.x-b.y);
    for(const tile of tiles){
      polygon(tile.points,color(tile.x+step/2,tile.y+step/2));
      const lo=Math.min(...tile.heights),hi=Math.max(...tile.heights);
      for(let level=Math.ceil(lo/20)*20;level<=hi;level+=20){
        if(level<20)continue;const intersections=[];
        for(let i=0;i<4;i++){
          const j=(i+1)%4,a=tile.heights[i],b=tile.heights[j];if((a<level)===(b<level)||a===b)continue;
          const t=(level-a)/(b-a),p=tile.world[i],q=tile.world[j];intersections.push(project(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,level*s));
        }
        if(intersections.length>=2){let path=contours.get(level);if(!path){path=[];contours.set(level,path);}for(let i=0;i+1<intersections.length;i+=2)path.push([intersections[i],intersections[i+1]]);}
      }
    }
    for(const [level,segments] of contours){ctx.beginPath();for(const [a,b] of segments){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.lineWidth=level%60===0?.65:.35;ctx.strokeStyle=level%60===0?'#e4dbb040':'#233d302b';ctx.stroke();}
    return tiles.length;
  }
  return {paint};
});
