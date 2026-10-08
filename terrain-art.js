/* Static terrain illustration shared by the campaign and visual study. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.TerrainArt=api;})(globalThis,function(){
 'use strict';
 function color(map,x,y){
  const z=map.height(x,y)/map.SCALE,g=map.gradient?.(x,y)||{x:0,y:0},slope=Math.hypot(g.x,g.y);
  const light=Math.max(-.28,Math.min(.28,(-g.x*.6-g.y*.8)*1.05));
  let hue=83+Math.max(0,1-z/65)*8,sat=21,l=48+light*53-Math.max(0,1-z/35)*4;
  if(z>100){const rock=Math.min(1,(z-100)/100+slope*.4);hue=83-rock*21;sat-=rock*12;l+=rock*8;}
  // Half-percent lightness steps retain relief while sharing canvas submissions.
  return `hsl(${Math.round(hue)} ${Math.round(sat)}% ${Math.round(l*2)/2}%)`;
 }
 function appendPolygon(ctx,points){points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();}
 function fillPolygons(ctx,polygons,fill){ctx.beginPath();for(const points of polygons)appendPolygon(ctx,points);ctx.fillStyle=fill;ctx.fill();ctx.strokeStyle=fill;ctx.lineWidth=1.4;ctx.stroke();}
 function tiles(map,project){
  const s=map.SCALE,step=12*s,result=[];
  for(let y=80*s;y<3220*s;y+=step)for(let x=160*s;x<4560*s;x+=step){
   if(!map.land(x+step/2,y+step/2))continue;
   const world=[[x,y],[x+step,y],[x+step,y+step],[x,y+step]],heights=world.map(([x,y])=>map.height(x,y)/s);
   result.push({x,y,points:world.map(([x,y])=>project(x,y)),heights,world,fill:color(map,x+step/2,y+step/2)});
  }
  return result;
 }
 function crossings(tile,level,project,scale){
  const result=[];
  for(let i=0;i<4;i++){
   const j=(i+1)%4,a=tile.heights[i],b=tile.heights[j];
   if((a<level)===(b<level)||a===b)continue;
   const t=(level-a)/(b-a),p=tile.world[i],q=tile.world[j];result.push(project(p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t,level*scale));
  }
  return result;
 }
 function addContours(contours,tile,project,scale){
  const lo=Math.min(...tile.heights),hi=Math.max(...tile.heights);
  for(let level=Math.max(20,Math.ceil(lo/20)*20);level<=hi;level+=20){
   const intersections=crossings(tile,level,project,scale);
   if(!contours.has(level))contours.set(level,[]);
   const path=contours.get(level);
   for(let i=0;i+1<intersections.length;i+=2)path.push([intersections[i],intersections[i+1]]);
  }
 }
 function drawContours(ctx,contours){
  for(const [level,segments] of contours){ctx.beginPath();for(const [a,b] of segments){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.lineWidth=level%60===0?.65:.35;ctx.strokeStyle=level%60===0?'#e4dbb040':'#233d302b';ctx.stroke();}
 }
 function paint(ctx,map,project){
  const ground=tiles(map,project),contours=new Map(),groups=new Map();
  // Bounded seeded slopes do not overlap in projection. Batch their flat patches.
  // Legacy geography can fold over itself, so preserve its painter order.
  if(!map.gradient)ground.sort((a,b)=>a.x+a.y-b.x-b.y);
  for(const tile of ground){
   if(map.gradient){if(!groups.has(tile.fill))groups.set(tile.fill,[]);groups.get(tile.fill).push(tile.points);}
   else fillPolygons(ctx,[tile.points],tile.fill);
   addContours(contours,tile,project,map.SCALE);
  }
  for(const [fill,polygons] of groups)fillPolygons(ctx,polygons,fill);
  drawContours(ctx,contours);return ground.length;
 }
 return {paint};
});
