(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Fog=api;})(globalThis,function(){
  'use strict';
  const CELL_SIZE=200,INTERVAL=.25;
  function create(map){
    const coast=map.coast||[],bounds=map.bounds;
    const minX=Math.floor(Math.min(bounds.minX,...coast.map(p=>p[0]))/CELL_SIZE)*CELL_SIZE;
    const minY=Math.floor(Math.min(bounds.minY,...coast.map(p=>p[1]))/CELL_SIZE)*CELL_SIZE;
    const maxX=Math.max(bounds.maxX,...coast.map(p=>p[0])),maxY=Math.max(bounds.maxY,...coast.map(p=>p[1]));
    const cols=Math.ceil((maxX-minX)/CELL_SIZE)+1,rows=Math.ceil((maxY-minY)/CELL_SIZE)+1;
    return {size:CELL_SIZE,minX,minY,cols,rows,visible:Array(cols*rows).fill(0),explored:Array(cols*rows).fill(0),revision:0,lastUpdate:null};
  }
  function index(fog,x,y){
    if(!fog||!Number.isFinite(x)||!Number.isFinite(y))return -1;
    const col=Math.floor((x-fog.minX)/fog.size),row=Math.floor((y-fog.minY)/fog.size);
    return col>=0&&row>=0&&col<fog.cols&&row<fog.rows?row*fog.cols+col:-1;
  }
  function visible(state,x,y){const fog=state.fog,i=index(fog,x,y);return i>=0&&fog.visible[i]===1;}
  function explored(state,x,y){const fog=state.fog,i=index(fog,x,y);return i>=0&&fog.explored[i]===1;}
  function stamp(fog,target,source,radius){
    const minCol=Math.max(0,Math.floor((source.x-radius-fog.minX)/fog.size)),maxCol=Math.min(fog.cols-1,Math.floor((source.x+radius-fog.minX)/fog.size));
    const minRow=Math.max(0,Math.floor((source.y-radius-fog.minY)/fog.size)),maxRow=Math.min(fog.rows-1,Math.floor((source.y+radius-fog.minY)/fog.size));
    for(let row=minRow;row<=maxRow;row++)for(let col=minCol;col<=maxCol;col++){
      const dx=fog.minX+(col+.5)*fog.size-source.x,dy=fog.minY+(row+.5)*fog.size-source.y;
      if(dx*dx+dy*dy<=radius*radius)target[row*fog.cols+col]=1;
    }
  }
  function update(state,map,force=false){
    const fog=state.fog||(state.fog=create(map)),time=Number.isFinite(state.time)?state.time:0;
    if(!force&&fog.lastUpdate!==null&&time>=fog.lastUpdate&&time-fog.lastUpdate<INTERVAL-1e-9)return fog;
    fog.lastUpdate=time;
    const next=Array(fog.cols*fog.rows).fill(0);
    for(const unit of state.units||[])if(unit.side==='blue'&&unit.hp>0)stamp(fog,next,unit,1000);
    for(const building of state.buildings||[])if(building.owner==='blue'&&building.hp>0&&!(building.remaining>0))stamp(fog,next,building,650);
    for(const facility of state.facilities||(state.regions||[]).map(r=>r.factory))if(facility&&facility.owner==='blue'&&facility.hp>0)stamp(fog,next,facility,700);
    let changed=false;
    for(let i=0;i<next.length;i++){if(next[i]!==fog.visible[i])changed=true;if(next[i]&&!fog.explored[i]){fog.explored[i]=1;changed=true;}}
    fog.visible=next;if(changed)fog.revision++;
    return fog;
  }
  return {CELL_SIZE,INTERVAL,create,update,visible,explored};
});
