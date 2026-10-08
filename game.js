(() => {
  'use strict';
  const F=window.Frontiers,S=window.World.SCALE,$=id=>document.getElementById(id);
  const canvas=$('battlefield'),host=canvas.parentElement;let ctx=canvas.getContext('2d');
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let state=Campaign.create({terrainSeed:TerrainField.randomSeed()}),G=state.map,width=1000,height=720,scale=.2,offset={x:0,y:0},cameraTween=null;
  let last=0,accumulator=0,uiTime=0,fps=60,fpsFrames=0,fpsStart=0,pointer=null,cursorScreen=null,hoverWorld=null,destinationMark=null,orderMode=false;
  const C={ink:'#253f3c'};
  const modelRenderer=FrontierModels.createRenderer();
  const ground=document.createElement('canvas');ground.width=3200;ground.height=1800;
  const g=ground.getContext('2d');
  let paintNeeded=true;
  let seed=94;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const scenery=[],detailRoads=[];
  let markerPositions=new Map();
  let attackMove=false,spaceHeld=false;
  const visualCache=new Map();
  const selection=new Set();
  let trenchAngle=0;
  let buildMode=null,rallyMode=false,fireMode=false,batteryMode=false,selectedBuilding=state.buildings[0]?.id,buildListKey='',recruitKey='',lastNotice='';
  state.paused=true;
  document.querySelector('.game').dataset.panel='army';

  function project(x,y,z){return Projection.project(x,y,z,G);}
  function screen(x,y,z){const p=project(x,y,z);return {x:p.x*scale+offset.x,y:p.y*scale+offset.y};}
  function unproject(sx,sy){return Projection.unproject(sx,sy,scale,offset,G);}
  function visible(o){return o.side==='blue'||o.owner==='blue'||Fog.visible(state,o.x,o.y);}
  function canvasPoint(e){const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*width/b.width,y:(e.clientY-b.top)*height/b.height};}
  function poly(c,points,fill,stroke,lineWidth=1){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lineWidth;c.stroke();}}
  const staticPaths=new WeakMap(),pathBounds=new WeakMap();
  function cachePath(points){const p=new Path2D();points.forEach((v,i)=>i?p.lineTo(v.x,v.y):p.moveTo(v.x,v.y));staticPaths.set(points,p);if(points.length)pathBounds.set(points,{minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxY:Math.max(...points.map(p=>p.y))});return points;}
  function path(c,points,color,lineWidth,dash=[]){const cached=staticPaths.get(points);if(!cached){c.beginPath();points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));}c.strokeStyle=color;c.lineWidth=lineWidth;c.lineCap='round';c.lineJoin='round';c.setLineDash(dash);if(cached)c.stroke(cached);else c.stroke();c.setLineDash([]);}

  function sampled(points,step=25){const result=[];for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],n=Math.ceil(F.distance(a,b)/step);for(let j=0;j<=n;j++){const x=a.x+(b.x-a.x)*j/n,y=a.y+(b.y-a.y)*j/n;result.push(project(x,y));}}return result;}
  let boundaryCache=new WeakMap();
  function boundary(r){let points=boundaryCache.get(r.polygon);if(!points){points=sampled([...r.polygon,r.polygon[0]].map(([x,y])=>({x,y})));cachePath(points);boundaryCache.set(r.polygon,points);}return points;}
  function terrainBase(){
    g.setTransform(.5,0,0,.5,0,0);g.clearRect(0,0,6400,3600);scenery.length=0;detailRoads.length=0;seed=state.terrainSeed??94;
    const coast=boundary({polygon:G.coast});poly(g,coast,'#aeba91','#ded6b2',18);g.save();poly(g,coast);g.clip();
    const p=(x,y,z)=>project(x*S,y*S,z===undefined?undefined:z*S);
    TerrainArt.paint(g,G,project);
    const river=[];for(let y=100*S;y<3250*S;y+=20*S)river.push(project(G.riverX(y),y,2*S));path(g,river,'#c8ccb0',78);path(g,river,'#527f89',67);path(g,river,'#82a8ac',56);path(g,river,'#aac5bd',1);
    for(const road of G.roads){const points=sampled(road,60);cachePath(points);detailRoads.push(points);path(g,points,'#7c816b',12/S);path(g,points,'#d5c9aa',8/S);}
    for(const r of state.regions){
      const agricultural=r.biome.includes('Agricultural')||r.id==='southfields';
      for(let i=0;i<(agricultural?26:5);i++){const x=r.x-650+random()*1300,y=r.y-600+random()*1200;if(!G.walkable(x,y)||G.regionAt(x,y)?.id!==r.id||(G.slope?.(x,y)||0)>.12)continue;const w=100+random()*130,d=80+random()*80;if(agricultural){poly(g,[project(x,y),project(x+w,y),project(x+w,y+d),project(x,y+d)],i%2?'#b8aa75':'#92a16e','#c9c39f',1);for(let j=10;j<d;j+=14)path(g,[project(x,y+j),project(x+w,y+j)],'#77875a',.6);}else if(G.terrain(x,y)==='open'){path(g,sampled([{x,y},{x:x+90,y:y+40}]),'#8d9776',1);}}
      scenery.push({x:r.x,y:r.y,w:115,d:65,h:45,kind:r.id==='westhaven'?'depot':'factory',factory:r.factory,draw:'building'});
      const city=['westhaven','eastwatch','greywater','ironvale'].includes(r.id),count=city?42:18;
      for(let i=0;i<count;i++){const x=r.x+(i%7-3)*65,y=r.y+125+Math.floor(i/7)*60;if(!G.walkable(x,y))continue;scenery.push({x,y,w:24+random()*22,d:22+random()*18,h:14+random()*(city?38:16),kind:i%5===0?'depot':'warehouse',draw:'building'});}
      if(r.id==='ironvale'||r.facility==='Arsenal')for(let i=0;i<5;i++)path(g,sampled([{x:r.x+260+i*20,y:r.y-250},{x:r.x+260+i*20,y:r.y+400}]),'#596d65',.8);
    }
    for(let i=0;i<22000;i++){const x=(300+random()*4100)*S,y=(220+random()*2800)*S,t=G.terrain(x,y);if(t==='forest'||(t==='open'&&random()<.02)){scenery.push({x,y,size:19+random()*22,draw:'tree'});const q=project(x,y);g.fillStyle=t==='forest'?'#426747':'#698467';g.fillRect(q.x-1.5,q.y-1,3,2);}}
    g.restore();for(const o of scenery){const p=project(o.x,o.y);o.px=p.x;o.py=p.y;}scenery.sort((a,b)=>a.x+a.y-b.x-b.y);
  }
  function tree(t){
    const p=project(t.x,t.y),type=Math.floor(t.x+t.y)%3===0?'pine':'tree';
    modelRenderer.draw(ctx,type,p.x,p.y,1/S,{side:'neutral',h:Math.round(t.size/4)*4,detail:scale/S>.7});
  }
  function buildingType(b){
    const f=b.factory;
    if(f?.type)return f.type;
    if(f){const name=f.name||'';if(name.includes('Oil'))return 'refinery';if(name.includes('Recruit'))return 'barracks';if(name.includes('Supply'))return 'supply';return b.kind==='depot'?'hq':'industry';}
    return b.kind==='depot'?'warehouse':'house';
  }
  function building(b){
    const f=b.factory,type=buildingType(b),p=project(b.x,b.y);
    const condition=f?.hp<=0?'ruined':f?.remaining>0?'construction':f&&f.hp<f.maxHp*.5?'damaged':'intact';
    const fixed=['trench','battery','refinery'].includes(type);
    modelRenderer.draw(ctx,type,p.x,p.y,1/S,{side:f?.owner||'neutral',state:condition,angle:f?.angle||0,turret:f?.aim||0,detail:scale/S>.38,
      w:fixed?undefined:b.w,d:fixed?undefined:b.d,h:fixed?undefined:(f?.remaining>0?32:b.h)});
    if(type==='battery'&&condition!=='ruined'&&condition!=='construction'&&scale/S>.38){
      for(let i=0;i<6;i++)soldier({x:b.x-40+i*16,y:b.y+30,side:f.owner,angle:f.aim||0});
    }
  }
  // The shared renderer owns a byte-bounded sprite cache, including structures.
  function staticBuilding(b){building({...b,w:Math.round(b.w/4)*4,d:Math.round(b.d/4)*4,h:Math.round(b.h/4)*4});}
  function vehicle(v){
    const p=project(v.x,v.y);
    modelRenderer.draw(ctx,v.type,p.x,p.y,1/S,{side:v.side,angle:v.angle,turret:v.turret,state:v.wreck?'ruined':'intact',detail:scale/S>.7});
  }
  function soldier(s){
    const p=project(s.x,s.y);
    modelRenderer.draw(ctx,'infantry',p.x,p.y,1/S,{side:s.side,angle:s.angle||0,pose:s.moving?'march':'stand',detail:scale/S>1});
  }

  function targetVisuals(u) {
    const count = u.type==='infantry'?0:Math.max(1, Math.ceil((u.type === 'tank' ? 6 : u.type==='artillery'?3:4) * u.hp / u.maxHp)), visuals = [];
    const bridge = Math.abs(u.x - G.riverX(u.y)) < 75;
    for (let i = 0; i < count; i++) {
      const back = bridge ? -i * 18 : -Math.floor(i / 2) * 22;
      const lateral = bridge ? 0 : (i % 2 ? 11 : -11);
      const angle = u.angle;
      visuals.push({ x: u.x + Math.cos(angle) * back - Math.sin(angle) * lateral, y: u.y + Math.sin(angle) * back + Math.cos(angle) * lateral,
        angle, turret: u.turret, type: u.type, side: u.side, draw: 'vehicle' });
    }
    const trench=F.trenchAt(state,u);
    if (u.type === 'mech'||u.type==='infantry') for (let i = 0; i < Math.ceil((u.type==='infantry'?28:12) * u.hp / u.maxHp); i++) {
      const walking = u.moving && !reduced.matches ? Math.sin(state.time * 5 + i) * .7 : 0;
      const entrenched=Boolean(trench),facing=trench?(trench.angle||0):u.angle,back=entrenched?(i%14-6.5)*12:(u.type==='infantry'?13.5: -12)-Math.floor(i/7)*9+walking,lateral=entrenched?Math.floor(i/14)*10-5:(u.type==='infantry'?-21:18)+(i%7)*7;
      visuals.push({x:u.x+Math.cos(facing)*back-Math.sin(facing)*lateral,y:u.y+Math.sin(facing)*back+Math.cos(facing)*lateral,side:u.side,angle:facing,moving:u.moving&&!entrenched,draw:'soldier'});
    }
    return visuals;
  }
  function visualUnits(u){return visualCache.get(u.id)||targetVisuals(u);}
  function updateVisuals(elapsed){if(scale/S<=.38){visualCache.clear();return;}const dt=state.paused?0:Math.max(0,Math.min(.05,elapsed));const blend=1-Math.exp(-12*dt);
    for(const u of state.units){if(u.hp<=0||!visible(u)||!onScreen(u,140)){visualCache.delete(u.id);continue;}const targets=targetVisuals(u),previous=visualCache.get(u.id);visualCache.set(u.id,targets.map((v,i)=>{const old=previous?.[i];if(!old||Math.hypot(old.x-v.x,old.y-v.y)>180)return v;const angle=old.angle===undefined?v.angle:old.angle+Math.atan2(Math.sin(v.angle-old.angle),Math.cos(v.angle-old.angle))*blend;return {...v,x:old.x+(v.x-old.x)*blend,y:old.y+(v.y-old.y)*blend,angle};}));}
  }
  function pickFormation(sx, sy) {
    const hits = [];
    for (const u of state.units) {
      if (u.hp <= 0 || !visible(u)) continue;
      const badge = markerPositions.get(u.id) || screen(u.x, u.y, G.height(u.x, u.y) + 39);
      let score = Math.abs(sx - badge.x) <= 20 && Math.abs(sy - badge.y) <= 15 ? 0 : Infinity;
      // Match the rendered formation, including its rear vehicles and dismounted infantry.
      for (const visual of scale/S > .38 ? visualUnits(u) : []) {
        const infantry = visual.draw === 'soldier';
        const p = screen(visual.x, visual.y, G.height(visual.x, visual.y) + (infantry ? 2.5 : 5));
        const radius = infantry ? Math.max(8, 5 * scale) : Math.max(12, 15 * scale);
        const distance = Math.hypot(p.x - sx, p.y - sy) / radius;
        if (distance <= 1) score = Math.min(score, distance);
      }
      if (Number.isFinite(score)) hits.push({ unit: u, score });
    }
    // A friendly selection wins over an overlapping attack target.
    hits.sort((a, b) => Number(b.unit.side === 'blue') - Number(a.unit.side === 'blue') || a.score - b.score);
    return hits[0]?.unit || null;
  }
  function ring(x,y,r,color){const points=[];for(let a=0;a<=Math.PI*2+.1;a+=.15)points.push(project(x+Math.cos(a)*r,y+Math.sin(a)*r));path(ctx,points,color,1.8/scale);}
  function drawText(text,x,y,color=C.ink){const p=screen(x,y,G.height(x,y)+15);if(p.x< -100||p.x>width+100||p.y<0||p.y>height)return;ctx.save();ctx.font='500 11px Segoe UI';ctx.textAlign='center';ctx.textBaseline='middle';const tw=ctx.measureText(text).width;ctx.fillStyle='#f0f2e7ed';ctx.beginPath();ctx.roundRect(p.x-tw/2-6,p.y-10,tw+12,20,3);ctx.fill();ctx.fillStyle=color;ctx.fillText(text,p.x,p.y);ctx.restore();}
  function onScreen(o,margin=90){const p=o.px===undefined?screen(o.x,o.y):{x:o.px*scale+offset.x,y:o.py*scale+offset.y};return p.x> -margin&&p.x<width+margin&&p.y> -margin&&p.y<height+margin;}
  let frontSegments=[],frontTime=-1,territoryPaths=null;
  const dryMask=new Path2D();dryMask.rect(0,0,6400,3600);
  const banks=[];for(let y=0;y<=3300*S;y+=20*S)banks.push(project(G.riverX(y)-38*S,y,2*S));for(let y=3300*S;y>=0;y-=20*S)banks.push(project(G.riverX(y)+38*S,y,2*S));dryMask.moveTo(banks[0].x,banks[0].y);for(const p of banks.slice(1))dryMask.lineTo(p.x,p.y);dryMask.closePath();
  const cellGeometry=new WeakMap(),frontVertices=new Map();
  function frontVertex(x,y){const key=x+','+y;let p=frontVertices.get(key);if(!p){p=project(x,y);frontVertices.set(key,p);}return p;}
  function cellPath(cell,size){let p=cellGeometry.get(cell);if(p)return p;p=new Path2D();[[cell.x,cell.y],[cell.x+size,cell.y],[cell.x+size,cell.y+size],[cell.x,cell.y+size]].forEach(([x,y],i)=>{const v=frontVertex(x,y);if(i)p.lineTo(v.x,v.y);else p.moveTo(v.x,v.y);});p.closePath();cellGeometry.set(cell,p);return p;}
  const frontTopology=new WeakMap();
  function topology(t){let mesh=frontTopology.get(t);if(mesh)return mesh;const vertices=[],vertexIds=new Map(),edges=[],size=t.size,lookup=new Map(t.cells.map((c,i)=>[c.x+','+c.y,i]));
    function vertex(x,y){const key=x+','+y;if(vertexIds.has(key))return vertexIds.get(key);const id=vertices.length;vertexIds.set(key,id);vertices.push({point:frontVertex(x,y),edges:[]});return id;}
    t.cells.forEach((c,i)=>{cellPath(c,size);for(const [dx,dy] of [[size,0],[0,size]]){const j=lookup.get((c.x+dx)+','+(c.y+dy));if(j===undefined)continue;const a=vertex(c.x+dx,c.y+dy),b=vertex(c.x+size,c.y+size),id=edges.length;edges.push({a,b,i,j});vertices[a].edges.push(id);vertices[b].edges.push(id);}});
    mesh={vertices,edges,active:new Uint8Array(edges.length),used:new Uint8Array(edges.length),degree:new Uint8Array(vertices.length)};frontTopology.set(t,mesh);return mesh;
  }
  function updateFront(){const t=state.territory;if(frontTime===t.revision)return;frontTime=t.revision;frontSegments=[];const m=topology(t);m.used.fill(0);m.degree.fill(0);
    territoryPaths={blue:new Path2D(),red:new Path2D(),neutral:new Path2D(),contested:new Path2D()};for(const c of t.cells){const p=cellGeometry.get(c);territoryPaths[c.owner].addPath(p);if(c.contested)territoryPaths.contested.addPath(p);}
    for(let k=0;k<m.edges.length;k++){const e=m.edges[k],active=t.cells[e.i].owner!==t.cells[e.j].owner;m.active[k]=active?1:0;if(active){m.degree[e.a]++;m.degree[e.b]++;}}
    function walk(start){const points=[m.vertices[start].point];let v=start;while(true){let next=-1;for(const k of m.vertices[v].edges)if(m.active[k]&&!m.used[k]){next=k;break;}if(next<0)break;m.used[next]=1;const e=m.edges[next];v=e.a===v?e.b:e.a;points.push(m.vertices[v].point);}if(points.length>1)frontSegments.push(points);}
    for(let v=0;v<m.vertices.length;v++)if(m.degree[v]===1)walk(v);for(let k=0;k<m.edges.length;k++)if(m.active[k]&&!m.used[k])walk(m.edges[k].a);
  }
  const frontCurveCache=new WeakMap();
  function frontPath(points,color,lineWidth){let p=frontCurveCache.get(points);if(!p){p=new Path2D();p.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length-1;i++){const a=points[i],b=points[i+1];p.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2);}const end=points.at(-1);p.lineTo(end.x,end.y);frontCurveCache.set(points,p);}ctx.strokeStyle=color;ctx.lineWidth=lineWidth;ctx.lineJoin='round';ctx.lineCap='round';ctx.stroke(p);}

  function layoutMarkers(){
    const bins=new Map();markerPositions.clear();
    function collides(q){const x=Math.floor(q.x/36),y=Math.floor(q.y/32);for(let j=y-1;j<=y+1;j++)for(let i=x-1;i<=x+1;i++)for(const a of bins.get(i+','+j)||[])if(Math.abs(a.x-q.x)<36&&Math.abs(a.y-q.y)<32)return true;return false;}
    for(const u of state.units){if(u.hp<=0||!visible(u)||!onScreen(u,0))continue;const anchor=screen(u.x,u.y,G.height(u.x,u.y)+39);let p=anchor;
      const free=q=>q.x>=16&&q.x<=width-16&&q.y>=12&&q.y<=height-20&&!collides(q);
      if(!free(p))search:for(let ring=1;ring<=8;ring++)for(const [dx,dy] of [[0,-1],[1,0],[-1,0],[0,1],[1,-1],[-1,-1],[1,1],[-1,1]]){const q={x:anchor.x+dx*36*ring,y:anchor.y+dy*32*ring};if(free(q)){p=q;break search;}}
      markerPositions.set(u.id,p);const key=Math.floor(p.x/36)+','+Math.floor(p.y/32);if(!bins.has(key))bins.set(key,[]);bins.get(key).push(p);
    }
  }
  let groundDetail=GroundDetail.create(G,project);
  function drawGroundDetail(){groundDetail.draw(ctx,[unproject(0,0),unproject(width,0),unproject(0,height),unproject(width,height)]);}
  const fogCanvas=document.createElement('canvas');fogCanvas.width=1600;fogCanvas.height=900;
  const fogContext=fogCanvas.getContext('2d');let fogState=null,fogRevision=-1,sightPath=new Path2D();
  function updateFogVisual(){const f=state.fog;if(fogState===f&&fogRevision===f.revision)return;fogState=f;fogRevision=f.revision;
    fogContext.setTransform(.25,0,0,.25,0,0);fogContext.clearRect(0,0,6400,3600);sightPath=new Path2D();const unknown=new Path2D(),remembered=new Path2D();
    // Merge equal fog cells into row strips, retaining terrain heights along both edges.
    for(let row=0;row<f.rows;row++){let col=0;while(col<f.cols){const start=col,kind=f.visible[row*f.cols+col]?2:f.explored[row*f.cols+col]?1:0;while(col<f.cols&&(f.visible[row*f.cols+col]?2:f.explored[row*f.cols+col]?1:0)===kind)col++;
      const path=kind===2?sightPath:kind===1?remembered:unknown,y=f.minY+row*f.size;
      for(let x=start;x<=col;x++){const p=frontVertex(f.minX+x*f.size,y);if(x===start)path.moveTo(p.x,p.y);else path.lineTo(p.x,p.y);}
      for(let x=col;x>=start;x--){const p=frontVertex(f.minX+x*f.size,y+f.size);path.lineTo(p.x,p.y);}path.closePath();}}
    fogContext.fillStyle='#14262cb8';fogContext.fill(unknown);fogContext.fillStyle='#14262c70';fogContext.fill(remembered);
  }
  const routeVisuals=new WeakMap();
  function drawRoute(u){let cached=routeVisuals.get(u);const key=u.path.map(p=>p.x+','+p.y).join(';');if(!cached||cached.key!==key){const points=sampled(u.path);cachePath(points);cached={key,points};routeVisuals.set(u,cached);}if(u.path.length)path(ctx,sampled([u,u.path[0]]),'#f6f1d4',2/scale,[5/scale,5/scale]);if(cached.points.length)path(ctx,cached.points,'#f6f1d4',2/scale,[5/scale,5/scale]);}
  function drawWorldImage(image){const x=Math.max(0,-offset.x/scale),y=Math.max(0,-offset.y/scale),right=Math.min(6400,(width-offset.x)/scale),bottom=Math.min(3600,(height-offset.y)/scale);if(right<=x||bottom<=y)return;const sx=image.width/6400,sy=image.height/3600;ctx.drawImage(image,x*sx,y*sy,(right-x)*sx,(bottom-y)*sy,x,y,right-x,bottom-y);}
  function previewPlan(){const units=selectedUnits();if(!units.length||!hoverWorld)return [];if(pointer?.button===2&&pointer.dragged&&!pointer.pan&&!activeMode())return F.formationPlan(units,pointer.world,hoverWorld);return orderMode&&!pointer?.pan?F.formationPlan(units,hoverWorld):[];}
  function render(elapsed){
    if(cursorScreen)hoverWorld=unproject(cursorScreen.x,cursorScreen.y);updateVisuals(elapsed);updateFront();updateFogVisual();
    const dpr=Math.min(devicePixelRatio||1,1.5);ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#94b6b0';ctx.fillRect(0,0,width,height);
    ctx.save();ctx.translate(offset.x,offset.y);ctx.scale(scale,scale);drawWorldImage(ground);
    if(scale>1){for(const points of detailRoads){const b=pathBounds.get(points);if(b&&(b.maxX*scale+offset.x< -10||b.minX*scale+offset.x>width+10||b.maxY*scale+offset.y< -10||b.minY*scale+offset.y>height+10))continue;path(ctx,points,'#83866f',12/S);path(ctx,points,'#d5c9aa',8/S);}}
    if(scale/S>.55)drawGroundDetail();
    // Political overlay belongs to the overview; close terrain keeps its authored colours.
    const fade=F.clamp((.8-scale)/.5,0,1),ownershipOpacity=fade*fade*(3-2*fade);
    const ownershipColours={blue:'#237f9e',red:'#b45046',neutral:'#d4cbb0'};
    if(ownershipOpacity>0){ctx.save();poly(ctx,boundary({polygon:G.coast}));ctx.clip();ctx.clip(dryMask,'evenodd');ctx.globalAlpha=.65*ownershipOpacity;for(const side of ['neutral','red','blue']){ctx.fillStyle=ownershipColours[side];ctx.fill(territoryPaths[side]);}ctx.restore();}
    for(const r of state.regions){const p=boundary(r);

      path(ctx,p,'#445e5960',1/scale);
      if(ownershipOpacity>0){ctx.save();ctx.globalAlpha=ownershipOpacity;path(ctx,p,r.owner==='neutral'?'#847c66':ownershipColours[r.owner],2/scale);ctx.restore();}
      if(r.id===state.selectedRegion){path(ctx,p,'#fff0b1',3/scale);path(ctx,p,'#b79149',1/scale);}
    }
    ctx.save();ctx.clip(sightPath);ctx.fillStyle='#ce8a4026';ctx.fill(territoryPaths.contested);ctx.restore();
    ctx.save();ctx.clip(sightPath);for(const line of frontSegments){frontPath(line,'#f7d99b35',10/scale);frontPath(line,'#fff0da',3.5/scale);frontPath(line,'#ad654e',1.3/scale);}
    ctx.restore();for(const r of state.regions)if(visible(r)&&onScreen(r,100)&&(scale>.45||r.id===state.selectedRegion)){ring(r.x,r.y,Territory.TOWN_RADIUS,r.captureStatus?.startsWith('Contested')?'#d36343':'#fff0b190');if(r.capturing){const points=[];for(let a=-Math.PI/2;a<=-Math.PI/2+2*Math.PI*r.factory.capture/100;a+=.05)points.push(project(r.x+Math.cos(a)*Territory.TOWN_RADIUS,r.y+Math.sin(a)*Territory.TOWN_RADIUS));if(points.length>1)path(ctx,points,r.capturing==='blue'?'#267d99':'#bc5148',4/scale);}}
    for(const selected of selectedUnits()){ring(selected.x-12,selected.y,Math.max(42,17/scale),'#fff0b1');if(selected.path.length)drawRoute(selected);}
    for(const slot of previewPlan())ring(slot.goal.x,slot.goal.y,Math.max(24,11/scale),state.map.walkable(slot.goal.x,slot.goal.y)?'#b9efd2':'#ed8468');
    if(destinationMark&&state.time-destinationMark.time<5){ring(destinationMark.x,destinationMark.y,Math.max(18,9/scale),'#fff0b1');for(const p of destinationMark.slots||[])ring(p.x,p.y,Math.max(8,4/scale),'#d4efc7');}
    for(const liveBridge of state.bridges){
      if(!onScreen(liveBridge,160))continue;
      const b=visible(liveBridge)?liveBridge:{...liveBridge,hp:liveBridge.maxHp},p=project(b.x,b.y,3*S);
      modelRenderer.draw(ctx,'bridge',p.x,p.y,1/S,{side:'neutral',state:b.hp<=0?'ruined':b.hp<b.maxHp*.5?'damaged':'intact',w:130*S,d:23*S,h:28*S,detail:scale/S>.38});
    }
    for(const c of state.craters)if(visible(c)&&onScreen(c)){const p=project(c.x,c.y);ctx.fillStyle='#493c3270';ctx.beginPath();ctx.ellipse(p.x,p.y,c.size/S,c.size*.5/S,0,0,7);ctx.fill();}
    const battery=buildingTarget();if(battery?.type==='battery'&&battery.owner==='blue'&&(batteryMode||document.querySelector('.game').dataset.panel==='build')){ring(battery.x,battery.y,Campaign.BUILDINGS.battery.range,'#e8b462');if(battery.fireTarget)ring(battery.fireTarget.x,battery.fireTarget.y,Campaign.BUILDINGS.battery.radius,'#ef945f');}if(fireMode)for(const u of selectedUnits().filter(u=>u.type==='artillery'))ring(u.x,u.y,u.range,'#e8b462');
    if(hoverWorld&&(buildMode||rallyMode||fireMode||batteryMode)){const p={...hoverWorld,angle:trenchAngle},valid=buildMode?!Campaign.placement(state,buildMode,p):state.map.walkable(p.x,p.y);ring(p.x,p.y,buildMode?70:batteryMode?240:95,valid?'#b9efd2':'#ed8468');if(buildMode){ctx.globalAlpha=.55;building({x:p.x,y:p.y,w:80,d:55,h:32,kind:'factory',factory:{type:buildMode,owner:valid?'blue':'red',hp:1,maxHp:1,remaining:0,angle:buildMode==='trench'?trenchAngle:0}});ctx.globalAlpha=1;}}

    const rally=buildingTarget();if(rally?.rally&&rally.owner==='blue'&&document.querySelector('.game').dataset.panel==='build'){ring(rally.rally.x,rally.rally.y,45,'#aee3d8');path(ctx,[project(rally.x,rally.y),project(rally.rally.x,rally.rally.y)],'#c9eddd',1/scale,[4/scale,4/scale]);}
    const objects=scenery.filter(o=>(scale/S>.24||o.factory)&&(o.factory?visible(o.factory):Fog.explored(state,o.x,o.y))&&onScreen(o));
    for(const b of state.buildings)if(visible(b)&&onScreen(b))objects.push({x:b.x,y:b.y,w:80,d:55,h:b.remaining>0?10:32,kind:b.type==='garage'||b.type==='supply'?'depot':'factory',factory:b,draw:'building'});
    if(scale/S>.38){for(const u of state.units)if(u.hp>0&&visible(u)&&onScreen(u))objects.push(...visualUnits(u));for(const w of state.wrecks)if(visible(w)&&onScreen(w))objects.push({...w,wreck:true,draw:'vehicle'});}
    objects.sort((a,b)=>a.x+a.y-b.x-b.y);
    for(const o of objects){if(o.draw==='tree'){if(scale/S>.26)tree(o);else{const p=project(o.x,o.y);ctx.fillStyle='#53745b';ctx.fillRect(p.x-5,p.y-3,10,6);}}else if(o.draw==='building'){if(o.factory)building(o);else staticBuilding(o);}else if(o.draw==='soldier')soldier(o);else vehicle(o);}
    for(const shot of state.shots){if(!visible(shot)||!Fog.visible(state,shot.tx,shot.ty)||(!onScreen(shot)&&!onScreen({x:shot.tx,y:shot.ty})))continue;const a=project(shot.x,shot.y,G.height(shot.x,shot.y)+10),b=project(shot.tx,shot.ty,G.height(shot.tx,shot.ty)+5),t=1-shot.ttl/.42;ctx.globalAlpha=1-t;path(ctx,[a,b],'#ffe7a4',Math.max(1.8,1/scale));ctx.fillStyle='#ffdb8c';ctx.beginPath();ctx.arc(b.x,b.y,(4+t*10),0,7);ctx.fill();ctx.globalAlpha=1;}
    for(const shell of state.shells){const t=1-shell.remaining/shell.total,x=shell.x+(shell.tx-shell.x)*t,y=shell.y+(shell.ty-shell.y)*t;if(!Fog.visible(state,x,y)||!onScreen({x,y},150))continue;const z=G.height(x,y)+Math.sin(t*Math.PI)*240,p=project(x,y,z),tail=project(x-(shell.tx-shell.x)*.025,y-(shell.ty-shell.y)*.025,z-8);path(ctx,[tail,p],'#fff4bd',2/scale);ctx.fillStyle='#ffe2a0';ctx.beginPath();ctx.arc(p.x,p.y,2.5/scale,0,7);ctx.fill();}
    for(const e of state.explosions){if(!visible(e)||!onScreen(e,100))continue;const t=1-e.ttl/e.total,p=project(e.x,e.y),radius=e.size/S*(.35+Math.min(t*5,1));ctx.globalAlpha=(1-t)*.8;ctx.fillStyle=t<.18?'#fff2b0':t<.4?'#ee9952':'#625e50';ctx.beginPath();ctx.ellipse(p.x,p.y-t*e.size/S,radius,radius*.75,0,0,7);ctx.fill();if(e.size>10&&!reduced.matches){ctx.strokeStyle='#ecd4a0';ctx.lineWidth=1/scale;ctx.beginPath();ctx.ellipse(p.x,p.y,radius*(1+t*2),radius*(.5+t),0,0,7);ctx.stroke();for(let i=0;i<6;i++){const a=i*2.399;const q=project(e.x+Math.cos(a)*e.size*t*2,e.y+Math.sin(a)*e.size*t*2,G.height(e.x,e.y)+Math.sin(t*Math.PI)*30);ctx.fillStyle='#f1bc76';ctx.fillRect(q.x,q.y,1/scale,1/scale);}}}ctx.globalAlpha=1;
    if(scale/S>.45&&!reduced.matches)for(const r of state.regions){const f=r.factory;if(!visible(f)||!onScreen(f)||f.hp<=0)continue;for(let i=0;i<3;i++){const phase=(state.time*.2+i/3)%1,p=project(f.x+phase*24,f.y-12,G.height(f.x,f.y)+48+phase*30);ctx.globalAlpha=.2*(1-phase);ctx.fillStyle=f.hp<100?'#394a42':'#edf0df';ctx.beginPath();ctx.ellipse(p.x,p.y,4+phase*10,3+phase*7,0,0,7);ctx.fill();}}ctx.globalAlpha=1;ctx.save();poly(ctx,boundary({polygon:G.coast}));ctx.clip();drawWorldImage(fogCanvas);ctx.restore();ctx.restore();
    for(const r of state.regions){if(!visible(r)){drawText(r.name+' · no current vision',r.x,r.y+130,'#606c68');continue;}if(scale<.5)drawText(r.name+' · '+(r.owner==='blue'?'Yours':r.owner==='red'?'Enemy':'Neutral'),r.x,r.y+130,r.owner==='blue'?'#175c76':r.owner==='red'?'#853a32':'#615944');else drawText(r.facility+(r.factory.hp<r.factory.maxHp*.5?' · damaged':''),r.x,r.y+75,r.owner==='blue'?'#286d7c':'#955644');}
    const queued=selectedUnit()?.commandQueue||[];for(const [i,next] of queued.entries()){if(!onScreen(next.destination,15))continue;const p=screen(next.destination.x,next.destination.y);ctx.fillStyle='#274955';ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#b1d8ef';ctx.lineWidth=1.5;ctx.stroke();ctx.font='600 10px Segoe UI';ctx.textAlign='center';ctx.fillStyle='#e7f6ff';ctx.fillText(String(i+1),p.x,p.y+3);}
    layoutMarkers();
    for(const u of state.units)if(u.hp>0){const p=markerPositions.get(u.id);if(!p)continue;const anchor=screen(u.x,u.y);path(ctx,[anchor,p],u.side==='blue'?'#397f9190':'#ad604c90',1);ctx.font='600 10px Segoe UI';ctx.textAlign='center';ctx.fillStyle=selection.has(u.id)?'#f9e3a7':u.side==='blue'?'#edf4e6':'#f8e2d2';ctx.beginPath();ctx.roundRect(p.x-15,p.y-9,30,18,3);ctx.fill();ctx.strokeStyle=u.side==='blue'?'#2d6b7d':'#9a4d43';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.fillText(u.side==='blue'?(u.label||u.id.toUpperCase()):u.militia?'◇':u.type==='artillery'?'▲':'◆',p.x,p.y+3);ctx.fillStyle='#294a3f45';ctx.fillRect(p.x-15,p.y+11,30,3);ctx.fillStyle=u.side==='blue'?'#397f91':'#ad604c';ctx.fillRect(p.x-15,p.y+11,30*u.hp/u.maxHp,3);}
    if(pointer?.dragged&&!pointer.pan&&pointer.button===0){const b=canvas.getBoundingClientRect(),x=Math.min(pointer.x,pointer.lastX)-b.left,y=Math.min(pointer.y,pointer.lastY)-b.top,w=Math.abs(pointer.lastX-pointer.x),h=Math.abs(pointer.lastY-pointer.y);ctx.fillStyle='#83c6db33';ctx.fillRect(x,y,w,h);ctx.strokeStyle='#e6f8ff';ctx.lineWidth=1.5;ctx.strokeRect(x,y,w,h);}
    if(hoverWorld&&!pointer?.dragged){const r=Campaign.at(state,hoverWorld.x,hoverWorld.y);ctx.font='11px Segoe UI';ctx.textAlign='left';ctx.fillStyle='#203e38';ctx.fillText(r?`${r.name} · ${G.terrain(hoverWorld.x,hoverWorld.y)} · ${Math.round(G.height(hoverWorld.x,hoverWorld.y))} m${orderMode?' · click to order':''}`:'Sea · cannot move here',20,height-65);}
  }
  function rotateTrench(direction){trenchAngle=(trenchAngle+direction*Math.PI/12+Math.PI*2)%(Math.PI*2);updateUI();}
  $('rotate-trench').onclick=()=>rotateTrench(1);
  const mini=$('minimap'),miniCtx=mini.getContext('2d'),miniBounds={x:G.bounds.minX,y:G.bounds.minY,w:G.bounds.maxX-G.bounds.minX,h:G.bounds.maxY-G.bounds.minY};
  const miniPoint=(x,y)=>({x:8+(x-miniBounds.x)/miniBounds.w*224,y:8+(y-miniBounds.y)/miniBounds.h*140});
  const miniRegions=G.regions.map(r=>{const path=new Path2D();r.polygon.forEach(([x,y],i)=>{const p=miniPoint(x,y);if(i)path.lineTo(p.x,p.y);else path.moveTo(p.x,p.y);});path.closePath();return {id:r.id,path};});
  let miniClock=0;
  function drawMinimap(){const now=performance.now();if(now-miniClock<250)return;miniClock=now;miniCtx.fillStyle='#182725';miniCtx.fillRect(0,0,240,156);for(const item of miniRegions){const r=Campaign.region(state,item.id);miniCtx.fillStyle=r.owner==='blue'?'#5b8990':r.owner==='red'?'#ae6751':'#8a8d66';miniCtx.fill(item.path);miniCtx.strokeStyle='#263a30';miniCtx.lineWidth=.65;miniCtx.stroke(item.path);}for(let row=0;row<state.fog.rows;row++)for(let col=0;col<state.fog.cols;col++){const f=state.fog,i=row*f.cols+col;if(f.visible[i])continue;const p=miniPoint(f.minX+col*f.size,f.minY+row*f.size);miniCtx.fillStyle=f.explored[i]?'#14262c70':'#14262cb8';miniCtx.fillRect(p.x,p.y,f.size/miniBounds.w*224+.2,f.size/miniBounds.h*140+.2);}for(const u of state.units){if(u.hp<=0||!visible(u))continue;const p=miniPoint(u.x,u.y);miniCtx.fillStyle=u.side==='blue'?'#d6f2ee':u.militia?'#dbcaa3':'#f8a782';miniCtx.fillRect(p.x-1,p.y-1,2,2);}const corners=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>{const p=unproject(x,y);return miniPoint(p.x,p.y);});miniCtx.beginPath();corners.forEach((p,i)=>i?miniCtx.lineTo(p.x,p.y):miniCtx.moveTo(p.x,p.y));miniCtx.closePath();miniCtx.strokeStyle='#ffebaa';miniCtx.lineWidth=1;miniCtx.stroke();}
  function navigateMinimap(e){const box=mini.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*240,y=(e.clientY-box.top)/box.height*156;cameraTo(scale,{x:miniBounds.x+F.clamp((x-8)/224,0,1)*miniBounds.w,y:miniBounds.y+F.clamp((y-8)/140,0,1)*miniBounds.h},false);miniClock=0;drawMinimap();}
  mini.addEventListener('pointerdown',e=>{if(e.button!==0)return;mini.setPointerCapture(e.pointerId);navigateMinimap(e);});mini.addEventListener('pointermove',e=>{if(mini.hasPointerCapture(e.pointerId))navigateMinimap(e);});mini.addEventListener('pointerup',e=>{if(mini.hasPointerCapture(e.pointerId))mini.releasePointerCapture(e.pointerId);});mini.addEventListener('keydown',e=>{const d={ArrowLeft:[-300,0],ArrowRight:[300,0],ArrowUp:[0,-300],ArrowDown:[0,300]}[e.key];if(!d)return;e.preventDefault();const p=unproject(width/2,height/2);cameraTo(scale,{x:p.x+d[0],y:p.y+d[1]},false);miniClock=0;drawMinimap();});
  function cancelMode(){buildMode=null;rallyMode=false;fireMode=false;batteryMode=false;orderMode=false;}
  function activeMode(){return Boolean(buildMode||rallyMode||fireMode||batteryMode||orderMode);}
  function feedback(message){$('facility-feedback').textContent=message;$('build-feedback').textContent=message;lastNotice=message;}
  function selectedUnits(){return state.units.filter(u=>selection.has(u.id)&&u.side==='blue'&&u.hp>0);}
  function selectedUnit(){return selectedUnits()[0];}
  function select(id,add=false){cancelMode();const u=state.units.find(u=>u.id===id&&u.side==='blue'&&u.hp>0);if(!u)return;if(!add)selection.clear();if(add&&selection.has(id))selection.delete(id);else selection.add(id);state.selected=selectedUnit()?.id||null;orderMode=false;updateUI();}
  function inspect(id,focus=false){state.selectedRegion=id;feedback('');if(focus)setView('region');updateUI();}
  function updateUI(){
    paintNeeded=true;
    drawMinimap();const units=selectedUnits();for(const id of selection)if(!units.some(u=>u.id===id))selection.delete(id);state.selected=units[0]?.id||null;if(!units.length)orderMode=false;
    const r=Campaign.region(state,state.selectedRegion),f=r.factory,u=units[0],all=Campaign.companies(state);
    $('selection-count').textContent=units.length+' selected';
    $('command-hint').textContent=orderMode?(attackMove?'Attack-move: click a destination · stops to fight':'Move: click a destination · disengages from combat'):units.length?units.map(u=>u.name).join(' + ')+' · Right-drag: form a line | Shift + right-click: queue':'Left-drag: box select · Shift: add · Space-drag: pan';
    if(buildMode)$('command-hint').textContent='Place '+Campaign.BUILDINGS[buildMode].name+' · controlled land near roads · Esc cancels';else if(rallyMode)$('command-hint').textContent='Click a rally point for newly produced troops · Esc cancels';else if(batteryMode)$('command-hint').textContent='Click bombardment target · 3,200 m range · 240 m blast · 18 materiel per volley';else if(fireMode)$('command-hint').textContent='Click an artillery target · infrastructure in the blast can be destroyed';
    $('fire-mission').disabled=!units.some(u=>u.type==='artillery');$('fire-mission').setAttribute('aria-pressed',String(fireMode));
    $('fuel').textContent=Math.floor(state.fuel);$('manpower').textContent=Math.floor(state.manpower);$('auto-retreat').checked=state.autoRetreat;
    $('supply-status').textContent=units.length?'Supply '+Math.round(units.reduce((n,u)=>n+u.supply,0)/units.length*100)+'% · fuel '+Math.round(units.reduce((n,u)=>n+u.fuel,0)/units.length*100)+'%'+(units.some(u=>!u.supplied)?' · carrying supplies / cut off':' · connected'):'';
    $('match-objective').textContent=Campaign.FACTIONS[state.faction].name+' · '+(state.mode==='short'?'Control 60% + Eastwatch':'Control every province')+' · '+Math.ceil((state.elapsedLimit-state.time)/60)+' minutes left · Seed '+(state.terrainSeed??'legacy');
    updateBuildUI();
    if(buildMode&&hoverWorld){const error=Campaign.placement(state,buildMode,{...hoverWorld,angle:trenchAngle});$('command-hint').textContent=(error||'Click to place '+Campaign.BUILDINGS[buildMode].name)+(buildMode==='trench'?' · R / Shift+R rotate · '+Math.round(trenchAngle*180/Math.PI)+'°':'')+' · Esc cancels';}
    $('rotate-trench').hidden=buildMode!=='trench';$('rotate-trench').textContent='Rotate trench · R · '+Math.round(trenchAngle*180/Math.PI)+'°';
    $('clear-selection').disabled=!units.length;
    document.querySelector('.map-title h2').textContent=scale<.4?'Republic of Arden':r.name;
    document.querySelector('.map-title p').textContent=scale<.4?'32 provinces · landscape '+(state.terrainSeed??'legacy'):r.biome+' · '+G.terrain(r.x,r.y)+' · '+Math.round(G.height(r.x,r.y))+' m';
    for(const mode of ['country','region','battle'])$('view-'+mode).setAttribute('aria-pressed',String(mode===(scale<.4?'country':scale<1.2?'region':'battle')));
    document.querySelectorAll('.legend span').forEach((item,i)=>{item.lastChild.textContent=(scale<.5?['Your territory','Enemy territory','Neutral territory']:['Your forces','Defenders','Frontline'])[i];if(i===2)item.querySelector('i').className=scale<.5?'neutral':'front';});
    $('country-owned').textContent=state.regions.filter(r=>r.owner==='blue').length+' / '+state.regions.length+' regions';$('region-picker').value=r.id;
    $('region-summary').textContent=r.biome+' · '+(r.owner==='blue'?'Your territory':r.owner==='neutral'?'Neutral militia':'Enemy territory');
    $('materiel').textContent=Math.floor(state.materiel);$('strength').textContent=Math.round(all.reduce((sum,u)=>sum+u.hp,0)/state.units.filter(u=>u.side==='blue').reduce((n,u)=>n+u.maxHp,0)*100)+'%';$('time').textContent=String(Math.floor(state.time/60)).padStart(2,'0')+':'+String(Math.floor(state.time%60)).padStart(2,'0');
    $('pause').textContent=state.paused?'Resume':'Pause';$('pause').setAttribute('aria-pressed',String(state.paused));
    if($('formation-list').children.length!==state.units.filter(u=>u.side==='blue').length)makeFormationButtons();
    for(const button of $('formation-list').children){const unit=state.units.find(u=>u.id===button.dataset.unit);button.disabled=unit.hp<=0;button.setAttribute('aria-pressed',String(selection.has(unit.id)));button.querySelector('.health').textContent=Math.ceil(unit.hp/unit.maxHp*100)+'%';button.querySelector('small').textContent=unit.hp<=0?'Destroyed':(Campaign.at(state,unit.x,unit.y)?.name||'Border')+' · '+(Campaign.TROOPS[unit.type]?.name||unit.type);}
    $('unit-name').textContent=units.length>1?units.length+' companies selected':u?.name||'Select a company';$('unit-state').textContent=units.length>1?units.map(u=>u.name+' · '+u.status).join(' / '):(u?u.status+((u.commandQueue?.length||0)?' · '+u.commandQueue.length+' queued waypoints':''):null)||'Click blue troops or drag a selection box. Shift adds companies.';
    const terrain=u?G.terrain(u.x,u.y):'open',effect=F.terrainModifiers[terrain]||F.terrainModifiers.open;
    const cover=effect.damage*(u&&F.trenchCover(state,u)?.5:1);
    $('terrain-effect').textContent=u?`${effect.name} · ${Math.round(G.height(u.x,u.y))} m · incoming damage -${Math.round((1-cover)*100)}% · terrain speed -${Math.round((1-effect.speed)*100)}%${F.trenchCover(state,u)?' · trench active':''}`:'Select troops to inspect terrain and cover';
    if(units.length>1)$('terrain-effect').textContent=units.map(u=>u.label+': '+G.terrain(u.x,u.y)).join(' · ')+' · cover applies per company';
    $('attack-move').disabled=!u;$('attack-move').setAttribute('aria-pressed',String(orderMode&&attackMove));
    $('hold').disabled=!u;$('retreat').disabled=!u;$('move-order').disabled=!u;$('move-order').setAttribute('aria-pressed',String(orderMode&&!attackMove));$('move-order').textContent=orderMode&&!attackMove?'Click destination · Esc cancels':'Move / disengage · M';$('focus-unit').disabled=!u;$('focus-unit').textContent=units.length>1?'Find selected group':'Find company';
    document.querySelector('.mission h2').textContent=(r.owner==='blue'?'Hold ':'Secure ')+r.name;document.querySelector('.mission>p:not(#match-objective)').textContent=r.owner==='blue'?'This facility supplies your shared stockpile.':'Push the border forward and hold the marked town zone. Capture reward: '+r.reward+' materiel.';
    $('capture-status').textContent=r.captureStatus||'Move troops into the marked town zone';$('capture-value').textContent=Math.round((r.ground?.blue||0)*100)+'% ground';$('capture-fill').style.width=((r.ground?.blue||0)*100)+'%';$('capture-detail').textContent='Need 35% ground + 8 seconds in the town zone. '+(r.capturing?'Town capture: '+Math.floor(f.capture)+'%.':'');
    document.querySelector('.facility-panel h2').textContent=r.facility;$('factory-condition').textContent=f.hp<=0?'Ruined':f.hp<100?'Damaged':'Operational';$('factory-fill').style.width=f.hp/f.maxHp*100+'%';$('factory-detail').textContent=(f.production*f.hp/f.maxHp).toFixed(1)+' materiel/s when controlled · '+Math.ceil(f.hp/f.maxHp*100)+'% integrity';
    $('bombard').textContent='Bombard '+r.facility.toLowerCase();$('bombard').disabled=!u||r.owner==='blue'||f.hp<=0;$('repair-factory').hidden=r.owner!=='blue'||f.hp>=f.maxHp;$('repair-factory').textContent=f.repair?'Pause facility repairs':'Repair facility';
    if(!visible(r)){ $('capture-status').textContent='Scout this region for current intelligence';$('capture-value').textContent='Unknown';$('capture-fill').style.width='0%';$('capture-detail').textContent='Move troops closer to reveal defenders and town activity.';$('factory-condition').textContent='No current vision';$('factory-fill').style.width='0%';$('factory-detail').textContent='Condition unknown';$('bombard').disabled=true;}
    const event=state.events.filter(e=>e.visibleToPlayer!==false).at(-1);$('event').textContent=lastNotice||event?.message||'Select a blue company. Right-click anywhere on land to move or attack.';
    $('performance').textContent=fps+' FPS · '+state.units.filter(u=>u.hp>0&&visible(u)).length+' visible formations · '+Math.round(scale*100)+'% zoom';
    document.querySelector('.game').dataset.selection=units.length?'yes':'no';$('cancel-order').hidden=!activeMode();$('unit-picker').value=units.length===1?units[0].id:'';$('fire-mission').hidden=!units.some(u=>u.type==='artillery');
    for(const [id] of Object.entries(actionGlyphs||{})){const button=$(id);button.title=button.textContent;button.setAttribute('aria-label',button.textContent);}
    $('outcome').hidden=!state.winner;if(state.winner)$('outcome').textContent=(state.winner==='blue'?'Victory · ':'Defeat · ')+(state.victoryReason||'Campaign concluded');
  }
  function makeFormationButtons(){ $('unit-picker').replaceChildren(new Option('Choose company',''));for(const u of state.units.filter(u=>u.side==='blue'&&u.hp>0))$('unit-picker').add(new Option(u.name,u.id));$('formation-list').replaceChildren();for(const u of state.units.filter(u=>u.side==='blue')){const b=document.createElement('button');b.className='formation-button';b.dataset.unit=u.id;b.innerHTML=`<span class="symbol">${u.type==='tank'?'▰':u.type==='artillery'?'▲':u.type==='infantry'?'⋀':'▥'}</span><span><strong>${u.name}</strong><small></small></span><span class="health"></span>`;b.onclick=e=>select(u.id,e.shiftKey);$('formation-list').appendChild(b);}}
  function countryScale(){return Math.min((width-55)/4500,(height-180)/2450);}
  function cameraTo(zoom,centre,animate=true){const p=project(centre.x,centre.y),to={scale:zoom,x:width/2-p.x*zoom,y:height/2+25-p.y*zoom};if(animate&&!reduced.matches)cameraTween={start:performance.now(),from:{scale,x:offset.x,y:offset.y},to};else{scale=to.scale;offset={x:to.x,y:to.y};cameraTween=null;}}
  function setView(mode){const r=Campaign.region(state,state.selectedRegion),u=selectedUnit();cameraTo(mode==='country'?countryScale():mode==='region'?Math.min((width-70)/650,(height-150)/450):2.2*S,mode==='country'?{x:2350*S,y:1570*S}:mode==='region'?r:u||r);}
  function resize(){const oldW=width,oldH=height,initial=!canvas.width||!last;const centre=unproject(oldW/2,oldH/2);width=host.clientWidth;height=host.clientHeight;const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(initial)cameraTo(countryScale(),{x:2350*S,y:1570*S},false);else cameraTo(Math.max(countryScale(),scale),centre,false);}
  function issue(sx,sy,hit,queued=false,lineStart=null){
    const units=selectedUnits();if(!units.length){feedback('Select a blue company first.');return;}
    const attacking=!lineStart&&hit?.side==='red',destination=attacking?hit:unproject(sx,sy);
    const plan=attacking?units.map(u=>({id:u.id,goal:destination})):F.formationPlan(units,lineStart||destination,lineStart?destination:null);
    let accepted=0;const destinations=[];
    for(const slot of plan){if(!attacking&&!state.map.walkable(slot.goal.x,slot.goal.y))continue;if(F.command(state,slot.id,attacking?'attack':orderMode&&attackMove?'advance':'move',attacking?hit.id:slot.goal,{queue:queued&&!attacking})){accepted++;destinations.push(slot.goal);}}
    if(accepted){destinationMark={x:destination.x,y:destination.y,time:state.time,slots:destinations};const r=Campaign.at(state,destination.x,destination.y);if(r)state.selectedRegion=r.id;orderMode=false;feedback(accepted+' of '+units.length+' companies '+(queued&&!attacking?'received queued waypoints.':'received the order.'));}
    else feedback('No reachable formation positions. Previous orders are unchanged.');updateUI();
  }
  for(const mode of ['country','region','battle'])$('view-'+mode).onclick=()=>setView(mode);
  $('pause').onclick=()=>{state.paused=!state.paused;updateUI();};
  function adopt(next){
    state=next;G=state.map;selection.clear();visualCache.clear();modelRenderer.clear();boundaryCache=new WeakMap();frontVertices.clear();
    groundDetail=GroundDetail.create(G,project);fogState=null;fogRevision=-1;terrainBase();
    orderMode=false;buildMode=null;rallyMode=false;fireMode=false;batteryMode=false;destinationMark=null;frontTime=-1;frontSegments=[];updateFront();accumulator=0;
    selectedBuilding=state.buildings.find(b=>b.owner==='blue')?.id;buildListKey='';recruitKey='';lastNotice='';makeFormationButtons();setView('country');updateUI();
  }
  $('restart').onclick=()=>{state.paused=true;$('campaign-setup').showModal();};
  $('begin-campaign').onclick=()=>{
    const input=$('terrain-seed');if(!input.reportValidity())return;
    const terrainSeed=input.value.trim()===''?TerrainField.randomSeed():Number(input.value);
    adopt(Campaign.create({faction:$('faction').value,mode:$('match-length').value,terrainSeed}));$('campaign-setup').close();state.paused=false;updateUI();
  };
  $('resume-campaign').onclick=()=>{$('campaign-setup').close();state.paused=false;updateUI();};
  $('campaign-setup').addEventListener('cancel',()=>{state.paused=false;});
  $('save-game').onclick=()=>{try{localStorage.setItem('living-frontiers-grand-v1',Campaign.serialize(state));feedback('Campaign saved on this browser.');}catch(error){feedback('Save failed: '+error.message);}updateUI();};
  $('load-game').onclick=()=>{try{const saved=localStorage.getItem('living-frontiers-grand-v1');if(!saved)throw Error('No saved campaign yet.');adopt(Campaign.restore(saved));feedback('Campaign restored and paused. Resume when ready.');}catch(error){feedback('Load failed: '+error.message);}updateUI();};
  function collapseConsole(collapsed){document.querySelector('.command-panel').classList.toggle('is-collapsed',collapsed);$('console-body').hidden=collapsed;$('toggle-console').textContent=collapsed?'Open':'Close';$('toggle-console').setAttribute('aria-expanded',String(!collapsed));$('toggle-console').setAttribute('aria-label',(collapsed?'Expand':'Collapse')+' command console');}
  $('cancel-order').onclick=()=>{cancelMode();feedback('Order cancelled. Selection kept.');updateUI();};$('help-button').onclick=()=>$('controls-help').showModal();$('close-help').onclick=()=>$('controls-help').close();
  $('toggle-console').onclick=()=>collapseConsole(!$('console-body').hidden);
  for(const button of document.querySelectorAll('.panel-tabs [data-panel]'))button.onclick=()=>{cancelMode();collapseConsole(button.dataset.panel==='army');document.querySelector('.game').dataset.panel=button.dataset.panel;for(const b of document.querySelectorAll('.panel-tabs [data-panel]'))b.setAttribute('aria-pressed',String(b===button));updateUI();};
  const buildGlyphs={barracks:'⚑',garage:'▰',battery:'⌖',trench:'⌑',supply:'▣',industry:'⚙',refinery:'◈'};
  for(const [type,d] of Object.entries(Campaign.BUILDINGS)){const button=document.createElement('button');button.className='build-icon';button.innerHTML='<span aria-hidden="true">'+buildGlyphs[type]+'</span><strong>'+d.name+'</strong><small>'+d.cost+' materiel · '+d.time+'s</small>';button.title=d.name+' · '+d.cost+' materiel';button.setAttribute('aria-label',button.title);button.onclick=()=>{$('build-kind').value=type;$('place-building').click();collapseConsole(true);canvas.focus({preventScroll:true});};$('build-icons').appendChild(button);}
  const actionGlyphs={'move-order':'➜','attack-move':'⚔','hold':'■','retreat':'↶','focus-unit':'◎','clear-selection':'×','fire-mission':'⌖','battery-target':'⌖','battery-stop':'■','set-rally':'⚑','cancel-queue':'×','upgrade-building':'↑','repair-building':'⚒','strike-building':'✹','inspect-region':'◎','bombard':'✹','repair-factory':'⚒'};
  for(const [id,glyph] of Object.entries(actionGlyphs)){$(id).classList.add('icon-action');$(id).dataset.glyph=glyph;}
  for(const tab of document.querySelectorAll('.panel-tabs [data-panel]')){const labels={army:['⚑','Troops'],build:['⚙','Economy & construction'],intel:['◉','Region intelligence']},[icon,label]=labels[tab.dataset.panel];tab.textContent=icon+' '+(tab.dataset.panel==='army'?'Army':tab.dataset.panel==='build'?'Build':'Region');tab.title=label;tab.setAttribute('aria-label',label);}
  const resourceIcons=['▣','◈','♟','♥','◷'];document.querySelectorAll('.resources>span').forEach((el,i)=>{const label=el.firstChild.textContent.trim();el.title=label;el.setAttribute('aria-label',label);el.firstChild.textContent=label+' ';});
  $('unit-picker').onchange=e=>{if(e.target.value)select(e.target.value);canvas.focus({preventScroll:true});};
  for(const [id,d] of Object.entries(Campaign.BUILDINGS)){const o=document.createElement('option');o.value=id;o.textContent=d.name+' · '+d.cost+' materiel';$('build-kind').appendChild(o);}
  function showBuildPage(manage){document.querySelector('.build-panel').dataset.page=manage?'manage':'place';$('show-construction').setAttribute('aria-pressed',String(!manage));$('show-management').setAttribute('aria-pressed',String(manage));}
  $('show-construction').onclick=()=>{cancelMode();showBuildPage(false);updateUI();};$('show-management').onclick=()=>{cancelMode();showBuildPage(true);updateUI();};showBuildPage(false);
  function buildingTarget(){return Campaign.infrastructure(state,selectedBuilding);}
  function updateBuildUI(){
    const all=[...state.buildings,...state.bridges].filter(visible),key=all.map(b=>b.id+':'+b.owner).join(',');if(key!==buildListKey){buildListKey=key;$('building-picker').replaceChildren();for(const b of all){const o=document.createElement('option');o.value=b.id;o.textContent=(b.owner==='blue'?'Your ':b.owner==='red'?'Enemy ':'')+b.name+' · '+(Campaign.at(state,b.x,b.y)?.name||'crossing');$('building-picker').appendChild(o);}}
    if(!all.some(b=>b.id===selectedBuilding))selectedBuilding=all[0]?.id;$('building-picker').value=selectedBuilding||'';const b=buildingTarget();if(!b){$('building-status').textContent='No infrastructure in sight';$('production-queue').textContent='';$('recruit-buttons').replaceChildren();return;}
    const own=b.owner==='blue',supplied=Campaign.at(state,b.x,b.y)?.supplied;
    $('building-status').textContent=Math.ceil(b.hp/b.maxHp*100)+'% integrity · '+(b.remaining>0?'Building: '+Math.ceil(b.remaining)+'s':b.hp<=0?'Ruined':b.index!==undefined?'Bridge crossing':supplied?'Supply connected':'Supply cut off')+(b.level?' · level '+b.level:'');
    const newKey=b.id+':'+b.owner;if(recruitKey!==newKey){recruitKey=newKey;$('recruit-buttons').replaceChildren();for(const type of own?Campaign.BUILDINGS[b.type]?.units||[]:[]){const d=Campaign.TROOPS[type],button=document.createElement('button');button.textContent='Recruit '+d.name+' · '+Math.ceil(d.materiel*(state.faction==='vanguard'&&type==='tank'?1.1:1))+' M / '+d.fuel+' F / '+d.manpower+' MP';button.onclick=()=>{feedback(Campaign.recruit(state,b.id,type));updateUI();};$('recruit-buttons').appendChild(button);}}
    $('production-queue').textContent=b.queue?.length?b.queue.map((q,i)=>(i+1)+'. '+Campaign.TROOPS[q.type].name+' · '+Math.ceil(q.remaining)+'s'+(!supplied?' · waiting for supply':'')).join('\n'):'Production queue empty';
    const battery=b.type==='battery';$('battery-target').hidden=!battery;$('battery-stop').hidden=!battery;$('battery-status').hidden=!battery;$('battery-target').disabled=!own||b.hp<=0||b.remaining>0;$('battery-stop').disabled=!own||!b.fireTarget;$('battery-status').textContent='Range 3,200 m · blast radius 240 m · 3 shells / 12s · 18 materiel. '+(b.fireStatus||'Awaiting target');
    $('set-rally').disabled=!own||!Campaign.BUILDINGS[b.type]?.units.length;$('cancel-queue').disabled=!own||!b.queue?.length;$('upgrade-building').disabled=!own||!b.level||b.level>=3;$('upgrade-building').textContent='Upgrade · '+(b.level||1)*150+' materiel';$('repair-building').disabled=b.hp>=b.maxHp;$('repair-building').textContent=b.repair?'Pause repairs':'Repair infrastructure';$('strike-building').disabled=b.owner==='blue'||b.hp<=0||!selectedUnits().length;
  }
  $('building-picker').onchange=e=>{selectedBuilding=e.target.value;const b=buildingTarget();if(b)cameraTo(1.3*S,b);updateUI();};
  $('place-building').onclick=()=>{const type=$('build-kind').value;cancelMode();buildMode=type;updateUI();};
  $('set-rally').onclick=()=>{cancelMode();rallyMode=true;collapseConsole(true);updateUI();};
  $('cancel-queue').onclick=()=>{feedback(Campaign.cancelQueue(state,selectedBuilding));updateUI();};$('upgrade-building').onclick=()=>{feedback(Campaign.upgrade(state,selectedBuilding));updateUI();};$('repair-building').onclick=()=>{feedback(Campaign.repair(state,selectedBuilding));updateUI();};
  $('strike-building').onclick=()=>{const target=buildingTarget();feedback(selectedUnits().map(u=>F.bombard(state,u.id,target)).join(' '));updateUI();};
  $('auto-retreat').onchange=e=>state.autoRetreat=e.target.checked;
  $('fire-mission').onclick=()=>{const next=!fireMode;cancelMode();fireMode=next;updateUI();};
  $('battery-target').onclick=()=>{cancelMode();batteryMode=true;collapseConsole(true);updateUI();};$('battery-stop').onclick=()=>{const b=buildingTarget();if(b?.owner==='blue')b.fireTarget=null;batteryMode=false;feedback('Bombardment stopped. Shells already fired remain in flight.');updateUI();};
  function specialClick(sx,sy){const p=unproject(sx,sy);if(batteryMode){const message=Campaign.batteryOrder(state,selectedBuilding,p);feedback(message);if(message.startsWith('Bombardment ordered'))batteryMode=false;updateUI();return true;}if(buildMode){const result=Campaign.construct(state,buildMode,{...p,angle:trenchAngle});if(typeof result==='string')feedback(result);else{selectedBuilding=result.id;showBuildPage(true);buildMode=null;feedback(result.name+' under construction.');}updateUI();return true;}if(rallyMode){const b=buildingTarget();if(b&&state.map.route(b,p).length){b.rally=p;rallyMode=false;feedback('Rally point set.');}else feedback('Choose reachable land.');updateUI();return true;}if(fireMode){feedback(selectedUnits().filter(u=>u.type==='artillery').map(u=>F.fireMission(state,u.id,p)).join(' '));destinationMark={...p,time:state.time};fireMode=false;batteryMode=false;updateUI();return true;}return false;}
  for(const r of state.regions){const option=document.createElement('option');option.value=r.id;option.textContent=r.name;$('region-picker').appendChild(option);}
  $('region-picker').onchange=e=>inspect(e.target.value);$('inspect-region').onclick=()=>setView('region');
  $('move-order').onclick=()=>{const next=!(orderMode&&!attackMove);cancelMode();orderMode=next;attackMove=false;updateUI();};$('attack-move').onclick=()=>{const next=!(orderMode&&attackMove);cancelMode();orderMode=next;attackMove=true;updateUI();};$('focus-unit').onclick=()=>{const units=selectedUnits();if(!units.length)return;const centre={x:units.reduce((n,u)=>n+u.x,0)/units.length,y:units.reduce((n,u)=>n+u.y,0)/units.length},points=units.map(u=>project(u.x,u.y));const zoom=units.length===1?Math.max(.9*S,scale):Math.min(1.2,(width-100)/(Math.max(...points.map(p=>p.x))-Math.min(...points.map(p=>p.x))+160),(height-200)/(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))+160));const r=Campaign.at(state,centre.x,centre.y);if(r)state.selectedRegion=r.id;cameraTo(zoom,centre);};
  $('clear-selection').onclick=()=>{cancelMode();selection.clear();state.selected=null;orderMode=false;updateUI();};
  $('hold').onclick=()=>{cancelMode();for(const u of selectedUnits())F.command(state,u.id,'hold');orderMode=false;updateUI();};$('retreat').onclick=()=>{cancelMode();for(const u of selectedUnits())F.command(state,u.id,'repair');orderMode=false;updateUI();};
  $('bombard').onclick=()=>{feedback(selectedUnits().map(u=>u.name+': '+F.bombard(state,u.id,Campaign.region(state,state.selectedRegion).factory)).join(' '));updateUI();};$('repair-factory').onclick=()=>{feedback(F.repairFactory(state,Campaign.region(state,state.selectedRegion).factory));updateUI();};
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{if(pointer)return;cameraTween=null;cursorScreen=canvasPoint(e);hoverWorld=unproject(cursorScreen.x,cursorScreen.y);canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);const b=canvas.getBoundingClientRect();pointer={id:e.pointerId,x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,dragged:false,world:{...hoverWorld},button:e.button,shift:e.shiftKey,pan:e.button===1||spaceHeld,targetId:pickFormation(cursorScreen.x,cursorScreen.y)?.id};});
  canvas.addEventListener('pointermove',e=>{paintNeeded=true;const b=canvas.getBoundingClientRect();cursorScreen=canvasPoint(e);hoverWorld=unproject(cursorScreen.x,cursorScreen.y);canvas.style.cursor=spaceHeld?'grab':orderMode||buildMode||rallyMode||fireMode||batteryMode?'crosshair':'default';if(!pointer||pointer.id!==e.pointerId)return;if(Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>5)pointer.dragged=true;if(pointer.dragged&&pointer.pan){cameraTween=null;offset.x+=(e.clientX-pointer.lastX)*width/b.width;offset.y+=(e.clientY-pointer.lastY)*height/b.height;}pointer.lastX=e.clientX;pointer.lastY=e.clientY;});
  canvas.addEventListener('pointerup',e=>{if(!pointer||pointer.id!==e.pointerId)return;const pressed=pointer;pointer=null;const b=canvas.getBoundingClientRect();
    if(pressed.dragged&&pressed.button!==2){if(!pressed.pan){cancelMode();const left=Math.min(pressed.x,e.clientX)-b.left,right=Math.max(pressed.x,e.clientX)-b.left,top=Math.min(pressed.y,e.clientY)-b.top,bottom=Math.max(pressed.y,e.clientY)-b.top;if(!pressed.shift)selection.clear();for(const u of state.units){if(u.side!=='blue'||u.hp<=0)continue;const points=[screen(u.x,u.y),markerPositions.get(u.id),...(scale/S>.38?visualUnits(u).map(v=>screen(v.x,v.y)):[])].filter(Boolean);if(points.some(p=>p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom))selection.add(u.id);}orderMode=false;updateUI();}return;}
    if(pressed.button===1||spaceHeld)return;
    const point=canvasPoint(e),sx=point.x,sy=point.y,hit=pressed.targetId?state.units.find(u=>u.id===pressed.targetId&&u.hp>0&&visible(u)):pickFormation(sx,sy);if(pressed.button===0&&specialClick(sx,sy))return;if(pressed.button===2){if(activeMode()){cancelMode();feedback('Order cancelled. Selection kept.');}else issue(sx,sy,hit,pressed.shift,pressed.dragged?pressed.world:null);}else if(hit?.side==='blue')select(hit.id,pressed.shift);else if(orderMode)issue(sx,sy,hit,pressed.shift);else{const p=unproject(sx,sy),b=state.buildings.find(b=>b.owner==='blue'&&F.distance(b,p)<70),r=Campaign.at(state,p.x,p.y);if(b){selectedBuilding=b.id;showBuildPage(true);collapseConsole(false);document.querySelector('.game').dataset.panel='build';for(const tab of document.querySelectorAll('.panel-tabs [data-panel]'))tab.setAttribute('aria-pressed',String(tab.dataset.panel==='build'));}if(r)inspect(r.id);}updateUI();});
  canvas.addEventListener('pointercancel',()=>pointer=null);canvas.addEventListener('pointerleave',()=>{cursorScreen=null;hoverWorld=null;});
  canvas.addEventListener('dblclick',e=>{const b=canvas.getBoundingClientRect(),point=canvasPoint(e),p=unproject(point.x,point.y),r=Campaign.at(state,p.x,p.y);if(r){inspect(r.id);cameraTo(Math.max(scale,.75),p);}});
  canvas.addEventListener('wheel',e=>{e.preventDefault();cameraTween=null;cursorScreen=canvasPoint(e);const x=cursorScreen.x,y=cursorScreen.y,old=scale;scale=F.clamp(scale*Math.exp(-e.deltaY*.0015),countryScale()*.8,3.2*S);offset.x=x-(x-offset.x)*scale/old;offset.y=y-(y-offset.y)*scale/old;const p=unproject(x,y),r=Campaign.at(state,p.x,p.y);if(r)state.selectedRegion=r.id;updateUI();},{passive:false});
  window.addEventListener('keydown',e=>{if($('campaign-setup').open||$('controls-help').open||e.ctrlKey||e.metaKey||e.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName))return;if(e.code==='Space'){e.preventDefault();spaceHeld=true;}if(e.key.toLowerCase()==='r'&&buildMode==='trench'){e.preventDefault();rotateTrench(e.shiftKey?-1:1);}if(e.key.toLowerCase()==='p'&&!e.repeat)$('pause').click();if(/^[1-9]$/.test(e.key))select(String.fromCharCode(96+Number(e.key)),e.shiftKey);if(e.key.toLowerCase()==='f'){if(document.querySelector('.game').dataset.panel==='build'&&buildingTarget()?.type==='battery')$('battery-target').click();else $('fire-mission').click();}if(e.key.toLowerCase()==='a')$('attack-move').click();if(e.key.toLowerCase()==='h')$('hold').click();if(e.key.toLowerCase()==='m')$('move-order').click();if(e.key==='Escape'){if(activeMode()){cancelMode();feedback('Order cancelled. Selection kept.');}else{selection.clear();state.selected=null;collapseConsole(true);}updateUI();}});
  window.addEventListener('keyup',e=>{if(e.code==='Space')spaceHeld=false;});window.addEventListener('blur',()=>{spaceHeld=false;pointer=null;});
  document.addEventListener('visibilitychange',()=>{last=0;accumulator=0;});
  function frame(now){const elapsed=last?Math.min((now-last)/1000,.25):0;last=now;if(!document.hidden){accumulator+=elapsed;while(accumulator>=.05){Campaign.step(state,.05);accumulator-=.05;}if(cameraTween){const t=Math.min(1,(now-cameraTween.start)/400),k=1-(1-t)**3;scale=cameraTween.from.scale+(cameraTween.to.scale-cameraTween.from.scale)*k;offset.x=cameraTween.from.x+(cameraTween.to.x-cameraTween.from.x)*k;offset.y=cameraTween.from.y+(cameraTween.to.y-cameraTween.from.y)*k;if(t>=1)cameraTween=null;}if(!state.paused||cameraTween||paintNeeded){render(elapsed);paintNeeded=false;}fpsFrames++;if(now-fpsStart>=1000){fps=Math.round(fpsFrames*1000/(now-fpsStart));fpsFrames=0;fpsStart=now;}uiTime+=elapsed;if(uiTime>.15){updateUI();uiTime=0;}}requestAnimationFrame(frame);}
  terrainBase();updateFront();makeFormationButtons();new ResizeObserver(entries=>{document.querySelector('.workspace').style.setProperty('--dock-height',entries[0].target.getBoundingClientRect().height+'px');}).observe(document.querySelector('.selection-dock'));new ResizeObserver(resize).observe(host);resize();updateUI();collapseConsole(true);$('campaign-setup').showModal();requestAnimationFrame(frame);
})();
