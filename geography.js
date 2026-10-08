(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Geography=api;})(globalThis,function(){
  'use strict';
  const coast=[[160,120],[360,50],[670,70],[1000,170],[1100,400],[990,650],[700,760],[400,735],[120,560],[70,300]].map(([x,y])=>[x*4,y*4]);
  const definitions=[
    ['westhaven','Westhaven',960,1000,'blue','Headquarters',.8,0,'Coastal town'],
    ['pinewood','Pinewood',1920,720,'neutral','Timber works',.7,35,'Dense woodland'],
    ['northreach','Northreach',2920,840,'neutral','Mountain foundry',1.1,45,'Highland ridge'],
    ['eastwatch','Eastwatch',3880,1440,'red','Eastern command',1.2,60,'Fortified coast'],
    ['lowlands','Lowlands',1000,1960,'neutral','Supply depot',.6,30,'Wetlands and pasture'],
    ['greywater','Greywater',2040,1640,'red','Steelworks',1.4,60,'River industry'],
    ['ironvale','Ironvale',3000,2040,'red','Armour works',1.6,70,'Quarry and rail yards'],
    ['southfields','Southfields',2120,2600,'neutral','Regional stores',.9,40,'Open farmland']
  ];
  function contains(p,x,y){let yes=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>y)!==(p[j][1]>y)&&x<(p[j][0]-p[i][0])*(y-p[i][1])/(p[j][1]-p[i][1])+p[i][0])yes=!yes;return yes;}
  function clip(poly,nx,ny,bound){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=a[0]*nx+a[1]*ny-bound,db=b[0]*nx+b[1]*ny-bound;if(da<=.001)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
  const regions=definitions.map(d=>{let polygon=coast;for(const b of definitions)if(b!==d)polygon=clip(polygon,b[2]-d[2],b[3]-d[3],(b[2]**2+b[3]**2-d[2]**2-d[3]**2)/2);return {id:d[0],name:d[1],x:d[2],y:d[3],owner:d[4],facility:d[5],production:d[6],reward:d[7],biome:d[8],polygon};});
  const regionAt=(x,y)=>regions.find(r=>contains(r.polygon,x,y));
  const riverX=y=>2440+Math.sin(y/470)*125;
  const bridges=[900,1800,2500];
  const nearBridge=y=>bridges.some(b=>Math.abs(y-b)<=45);
  const water=(x,y)=>Math.abs(x-riverX(y))<38&&!nearBridge(y);
  const land=(x,y)=>contains(coast,x,y);
  const walkable=(x,y)=>land(x,y)&&!water(x,y);
  function height(x,y){
    const river=Math.abs(x-riverX(y));
    const ridge=95*Math.exp(-(((x-2990)/460)**2+((y-680)/350)**2));
    const quarry=32*Math.exp(-(((x-3200)/350)**2+((y-2060)/320)**2));
    return river<40?2:7+(ridge+quarry+9*Math.sin(x/310)*Math.sin(y/380))*Math.min(1,(river-40)/150);
  }
  function terrain(x,y){
    if(!land(x,y)||water(x,y))return 'water';
    if(height(x,y)>36)return 'hill';
    if(((x-1840)/520)**2+((y-760)/380)**2<1||((x-3530)/230)**2+((y-1680)/230)**2<1)return 'forest';
    if(((x-1060)/400)**2+((y-2150)/240)**2<1)return 'marsh';
    return 'open';
  }
  // One navigation grid for the entire country. Routes cannot cut corners across water.
  const cell=40,cols=116,rows=81,grid=new Uint8Array(cols*rows);
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)grid[y*cols+x]=walkable(x*cell,y*cell)?1:0;
  const point=i=>({x:(i%cols)*cell,y:Math.floor(i/cols)*cell});
  function visible(a,b){const n=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/10);for(let i=0;i<=n;i++)if(!walkable(a.x+(b.x-a.x)*i/Math.max(1,n),a.y+(b.y-a.y)*i/Math.max(1,n)))return false;return true;}
  function nearest(p){let best=-1,d=Infinity;const gx=Math.round(p.x/cell),gy=Math.round(p.y/cell);for(let y=Math.max(0,gy-3);y<=Math.min(rows-1,gy+3);y++)for(let x=Math.max(0,gx-3);x<=Math.min(cols-1,gx+3);x++){const i=y*cols+x,q=point(i),v=Math.hypot(q.x-p.x,q.y-p.y);if(grid[i]&&v<d&&visible(p,q)){best=i;d=v;}}return best;}
  function route(from,to){
    if(!walkable(to.x,to.y))return [];
    if(visible(from,to))return [{x:to.x,y:to.y}];
    const start=nearest(from),end=nearest(to);if(start<0||end<0)return [];
    const costs=new Float64Array(grid.length).fill(Infinity),parents=new Int32Array(grid.length).fill(-1),closed=new Uint8Array(grid.length),open=[start];costs[start]=0;
    const heuristic=i=>Math.hypot(i%cols-end%cols,Math.floor(i/cols)-Math.floor(end/cols));
    while(open.length){let bi=0;for(let j=1;j<open.length;j++)if(costs[open[j]]+heuristic(open[j])<costs[open[bi]]+heuristic(open[bi]))bi=j;
      const current=open.splice(bi,1)[0];if(current===end){const raw=[to];for(let i=end;i!==start;i=parents[i])raw.push(point(i));raw.push(point(start));raw.reverse();const result=[];let anchor=from;for(let i=0;i<raw.length;){let j=raw.length-1;while(j>i&&!visible(anchor,raw[j]))j--;result.push(raw[j]);anchor=raw[j];i=j+1;}return result;}
      closed[current]=1;const x=current%cols,y=Math.floor(current/cols);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=cols||yy>=rows)continue;const next=yy*cols+xx;if(!grid[next]||closed[next]||!visible(point(current),point(next)))continue;const cost=costs[current]+Math.hypot(dx,dy);if(cost>=costs[next])continue;parents[next]=current;costs[next]=cost;if(!open.includes(next))open.push(next);}
    }return [];
  }
  // Regional links become actual roads over the same navigable terrain.
  const links=[[0,1],[0,4],[1,2],[1,5],[2,3],[2,6],[3,6],[4,5],[4,7],[5,6],[5,7],[6,7]];
  const roads=links.map(([a,b])=>[regions[a],...route(regions[a],regions[b])]);
  const length=points=>points.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-points[i].x,p.y-points[i].y),0);
  function travelRoute(from,to){
    const direct=route(from,to);if(!direct.length||Math.hypot(from.x-to.x,from.y-to.y)<500)return direct;
    const start=regions.indexOf(regionAt(from.x,from.y)),end=regions.indexOf(regionAt(to.x,to.y));
    if(start<0||end<0||start===end)return direct;
    const costs=regions.map(()=>Infinity),paths=regions.map(()=>[]),pending=new Set(regions.map((_,i)=>i));costs[start]=0;
    while(pending.size){const a=[...pending].reduce((a,b)=>costs[a]<costs[b]?a:b);pending.delete(a);if(a===end)break;
      links.forEach(([u,v],i)=>{if(u!==a&&v!==a)return;const b=u===a?v:u,points=u===a?roads[i]:[...roads[i]].reverse(),cost=costs[a]+length(points);if(cost<costs[b]){costs[b]=cost;paths[b]=[...paths[a],...points.slice(1)];}});
    }
    const approach=route(from,regions[start]),departure=route(regions[end],to);
    if(!approach.length||!departure.length)return direct;
    const via=[...approach,...paths[end],...departure];
    // Prefer established roads on long trips, but avoid a large detour for a nearby border.
    return length([from,...via])<=length([from,...direct])*1.65?via:direct;
  }
  return {coast,regions,regionAt,contains,riverX,bridges,water,land,walkable,height,terrain,route:travelRoute,roads,visible};
});
