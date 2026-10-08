(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.Projection=api;})(globalThis,function(){
  'use strict';
  function project(x,y,z,map){
    const s=map.SCALE;
    if(z===undefined)z=map.height(x,y);
    return {x:2700+(x-y)*.84/s,y:55+(x+y)*.42/s-z/s};
  }
  function unproject(sx,sy,scale,offset,map){
    const s=map.SCALE,px=(sx-offset.x)/scale-2700,py=(sy-offset.y)/scale-55;
    const point=z=>({x:((py+z/s)/.42+px/.84)*s/2,y:((py+z/s)/.42-px/.84)*s/2});
    // Use the campaign's actual height range, including seeded mountains.
    // Bracket the terrain intersection: fixed-point iteration oscillates on river banks.
    let lo=map.heightBounds?.min??-16*s,hi=map.heightBounds?.max??160*s;
    for(let i=0;i<32;i++){
      const z=(lo+hi)/2,p=point(z);
      if(z>map.height(p.x,p.y))hi=z;else lo=z;
    }
    return point((lo+hi)/2);
  }
  return {project,unproject};
});
