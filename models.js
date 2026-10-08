/* Original geometric model art. Local dimensions are world units, not screen pixels. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.FrontierModels=api;
})(globalThis,function(){
  'use strict';
  const TAU=Math.PI*2;
  const catalogue=[
    ['infantry','Rifle infantry','Troops','Helmet, webbing, pack and rifle; a human silhouette at close range.'],
    ['tank','Medium tank','Troops','Sloped hull, separate turret, running gear and engine deck.'],
    ['mech','Armoured transport','Troops','Six road wheels, raised cab, vision ports and rear troop compartment.'],
    ['artillery','Field gun','Troops','Gun shield, split trail, wheels and a long barrel. Also supports legacy mobile artillery.'],
    ['battery','Artillery emplacement','Structures','Three field guns, ammunition and protective sandbags.'],
    ['trench','Infantry trench','Structures','Traverses, timber lining, duckboards and a raised earth parapet.'],
    ['barracks','Barracks','Structures','Pitched roof, dormitory windows, entrance steps and a muster yard.'],
    ['garage','Vehicle depot','Structures','Wide maintenance bays, roof vents and workshop doors.'],
    ['supply','Supply depot','Structures','Loading platform, covered store and stacked transport crates.'],
    ['industry','Machine works','Structures','Sawtooth roof lights, brick chimney and an industrial loading door.'],
    ['refinery','Oil refinery','Structures','Storage vessels, a distillation tower and connected pipework.'],
    ['hq','Regional headquarters','Structures','Command building, observation tower and radio aerial.'],
    ['house','Town building','Scenery','Gabled roof, chimney, doors and inset windows.'],
    ['warehouse','Warehouse','Scenery','Ribbed metal roof, loading door and side windows.'],
    ['bridge','Road bridge','Scenery','Deck, piers and steel side trusses; a broken centre when destroyed.'],
    ['tree','Broadleaf tree','Scenery','Faceted canopy clusters, exposed branches and an asymmetric crown.'],
    ['pine','Conifer','Scenery','Layered branches and a narrow, recognisable evergreen silhouette.'],
    ['crate','Supply crates','Props','Timber panels, reinforcing battens and stacked field stores.'],
    ['sandbags','Sandbag position','Props','Staggered protective courses with seams and a curved gun opening.'],
    ['tank-store','Oil storage vessel','Props','Cylindrical tank, access hatch, bands and ladder.'],
    ['stack','Industrial chimney','Props','Tapered brick stack with a dark open flue.']
  ].map(([id,name,group,description])=>({id,name,group,description}));
  const metal=['#83978a','#415d56','#627970'],stone=['#b6b6a0','#707e72','#919e8a'];
  const rubber=['#4d554c','#263831','#38483e'],wood=['#9b8862','#605c45','#7c7555'];
  const earth=['#a6946b','#635d43','#827a53'],brick=['#a08a71','#645e50','#817560'];
  const faction=side=>side==='red'?['#b69a7d','#6f5649','#907563']:side==='neutral'?['#a5a48b','#626b58','#838e73']:['#829c8d','#3e6058','#608477'];
  const accent=side=>side==='red'?'#edb099':side==='neutral'?'#e3d4a5':'#afe0d5';
  const sizes={infantry:[6,5,8],tank:[20,12,11],mech:[18,11,11],artillery:[28,18,14],battery:[90,70,18],trench:[220,48,8],barracks:[80,55,28],garage:[80,55,26],supply:[80,55,28],industry:[80,55,32],refinery:[80,55,52],hq:[115,65,45],house:[38,30,26],warehouse:[46,36,28],bridge:[130,23,28],tree:[26,24,42],pine:[24,24,46],crate:[17,13,12],sandbags:[40,25,6],'tank-store':[28,28,35],stack:[16,16,64]};

  function createMesh(type,options={}){
    const faces=[],angle=options.angle||0,ca=Math.cos(angle),sa=Math.sin(angle),detail=options.detail!==false;
    const side=options.side||'blue',paint=faction(side),mark=accent(side),state=options.state||'intact';
    const base=sizes[type]||sizes.warehouse;
    const sx=(options.w||base[0])/base[0],sy=(options.d||base[1])/base[1],sz=(options.h||base[2])/base[2];
    function point(x,y,z){x*=sx;y*=sy;return [x*ca-y*sa,x*sa+y*ca,z*sz];}
    function face(vertices,color){faces.push({points:vertices.map(p=>point(...p)),color});}
    function prism(points,z,h,colors=metal,topScale=1){
      const cx=points.reduce((n,p)=>n+p[0],0)/points.length,cy=points.reduce((n,p)=>n+p[1],0)/points.length;
      const low=points.map(p=>[p[0],p[1],z]),high=points.map(p=>[cx+(p[0]-cx)*topScale,cy+(p[1]-cy)*topScale,z+h]);
      for(let i=0;i<points.length;i++){
        const j=(i+1)%points.length,dx=points[j][0]-points[i][0],dy=points[j][1]-points[i][1];
        const nx=dy*ca+dx*sa,ny=dy*sa-dx*ca;
        if(nx+ny>-.001)face([low[i],low[j],high[j],high[i]],colors[Math.abs(nx)>Math.abs(ny)?2:1]);
      }
      face(high,colors[0]);
    }
    function box(x,y,z,w,d,h,colors=metal,a=0){
      const c=Math.cos(a),s=Math.sin(a);
      prism([[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([u,v])=>[x+u*c-v*s,y+u*s+v*c]),z,h,colors);
    }
    function chamfer(x,y,z,w,d,h,colors=metal,a=0,taper=.85){
      const c=Math.cos(a),s=Math.sin(a),k=Math.min(w,d)*.2;
      let outline=[[-w/2+k,-d/2],[w/2-k,-d/2],[w/2,-d/2+k],[w/2,d/2-k],[w/2-k,d/2],[-w/2+k,d/2],[-w/2,d/2-k],[-w/2,-d/2+k]];
      if(detail&&(type==='tank'||type==='mech')){
        outline=[];for(const [cx,cy,start] of [[w/2-k,-d/2+k,-Math.PI/2],[w/2-k,d/2-k,0],[-w/2+k,d/2-k,Math.PI/2],[-w/2+k,-d/2+k,Math.PI]])for(let i=0;i<4;i++){const a=start+i*Math.PI/6;outline.push([cx+Math.cos(a)*k,cy+Math.sin(a)*k]);}
      }
      prism(outline.map(([u,v])=>[x+u*c-v*s,y+u*s+v*c]),z,h,colors,taper);
    }
    function cylinder(x,y,z,r,h,colors=metal,n=10,taper=1){
      if(detail&&(type==='refinery'||type==='tank-store'))n=Math.max(n,20);
      prism(Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*r,y+Math.sin(i*TAU/n)*r]),z,h,colors,taper);
    }
    function beam(a,b,thickness,color){
      const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy),q=length?[-dy/length*thickness/2,dx/length*thickness/2]:[thickness/2,0];
      const points=[[a[0]+q[0],a[1]+q[1],a[2]],[b[0]+q[0],b[1]+q[1],b[2]],[b[0]-q[0],b[1]-q[1],b[2]],[a[0]-q[0],a[1]-q[1],a[2]]];
      face(points,color);face(points.map(p=>[p[0],p[1],p[2]+thickness]),color);
      face([points[0],points[1],[points[1][0],points[1][1],points[1][2]+thickness],[points[0][0],points[0][1],points[0][2]+thickness]],'#45564b');
    }
    function wheel(x,y,z,r=2,a=0){
      // Vertical wheel faces, parallel to the vehicle's direction of travel.
      const ring=Array.from({length:10},(_,i)=>[x+Math.cos(i*TAU/10)*r*Math.cos(a),y+Math.cos(i*TAU/10)*r*Math.sin(a),z+Math.sin(i*TAU/10)*r]);
      face(ring,'#253830');face(ring.map(p=>[x+(p[0]-x)*.55-Math.sin(a)*.06,y+(p[1]-y)*.55+Math.cos(a)*.06,z+(p[2]-z)*.55]),'#7a8270');
    }
    function crate(x,y,z,w=9,d=7,h=6){box(x,y,z,w,d,h,wood);if(detail){for(const q of [-.34,.34])box(x+q*w,y,z+h,w*.07,d+.3,.4,stone);box(x,y+d/2+.12,z+h*.35,w,.2,.6,earth);}}
    function bag(x,y,z,a=0){chamfer(x,y,z,7,3.6,2.2,earth,a,.83);}
    function roof(x,y,z,w,d,rise,colors=metal){
      face([[x-w/2,y-d/2,z],[x+w/2,y-d/2,z],[x+w/2,y,z+rise],[x-w/2,y,z+rise]],colors[0]);
      face([[x-w/2,y,z+rise],[x+w/2,y,z+rise],[x+w/2,y+d/2,z],[x-w/2,y+d/2,z]],colors[1]);
      face([[x+w/2,y-d/2,z],[x+w/2,y+d/2,z],[x+w/2,y,z+rise]],colors[2]);
      face([[x-w/2,y+d/2,z],[x-w/2,y-d/2,z],[x-w/2,y,z+rise]],colors[2]);
      if(detail){
        beam([x-w/2,y,z+rise+.15],[x+w/2,y,z+rise+.15],.65,colors[0]);
        for(const side of [-1,1]){beam([x-w/2,y+side*d/2,z],[x+w/2,y+side*d/2,z],.8,stone[0]);
          for(let j=1;j<5;j++){const f=j/5;beam([x-w/2,y+side*d/2*f,z+rise*(1-f)+.1],[x+w/2,y+side*d/2*f,z+rise*(1-f)+.1],.2,colors[2]);}}
      }
    }
    function windows(x,y,z,w){for(let i=-w/2+6;i<w/2-2;i+=11){box(x+i,y,z,5,.4,6,['#899e90','#304d47','#406157']);if(detail)box(x+i,y+.35,z+2.8,5,.2,.45,stone);}}
    function doorway(x,y,w=12,h=13){box(x,y,2,w,.5,h,rubber);if(detail)for(let z=4;z<h;z+=2)box(x,y+.35,z,w,.15,.2,metal);}
    function flag(x,y,z){box(x,y,0,.6,.6,z,metal);box(x+3,y,z-6,6,.4,4,[mark,mark,mark]);}
    function gun(x,y,a=0){
      const c=Math.cos(a),s=Math.sin(a),p=(f,l,z)=>[x+f*c-l*s,y+f*s+l*c,z];
      box(x,y,2,6,8,3,paint,a);
      for(const l of [-1,1]){beam(p(-1,l*2,3),p(-13,l*6,1),1.2,paint[2]);const q=p(-13,l*6,0);box(q[0],q[1],0,4,3,1,metal,a);}
      for(const l of [-5,5]){const q=p(0,l,3);wheel(q[0],q[1],3,2.8,a);}
      const shield=p(2,0,3);box(shield[0],shield[1],3,1.3,12,7,paint,a);
      beam(p(-4,0,6),p(ruin?7:19,0,ruin?2:10),1.1,paint[1]);if(!ruin)beam(p(14,0,9.2),p(20,0,10.2),1.6,metal[0]);
      if(detail){const q=p(-3,2,6);cylinder(q[0],q[1],6,1.5,.5,metal,8);}
    }
    function storage(x,y,r=11,h=27){
      cylinder(x,y,1,r,h,stone,12);cylinder(x,y,h+1,r,1.3,metal,12);cylinder(x,y,h+2.3,r*.92,1,stone,12,.8);
      if(detail){for(const z of [8,19])cylinder(x,y,z,r+.15,.55,metal,12);box(x+r+.3,y,1,.6,.6,h,metal);for(let z=3;z<h;z+=3)box(x+r+.5,y,z,.4,3,.4,metal);cylinder(x,y,h+3,2.5,1,metal,8);}
    }
    function chimney(x,y,h=52){chamfer(x,y,0,10,10,h,brick,0,.7);box(x,y,h,9,9,2,stone);box(x,y,h+2.05,5.5,5.5,.15,rubber);if(detail)for(let z=8;z<h;z+=9)box(x,y,z,9-z*.035,9-z*.035,.45,earth);}

    // Ruins retain a characteristic footprint, but never look operational.
    const ruin=state==='ruined',damaged=state==='damaged';
    if(ruin&&!['tree','pine','bridge','trench','tank','mech','artillery','infantry'].includes(type)){
      box(0,0,0,base[0],base[1],2,['#77796a','#4a574b','#646d5a']);
      if(type==='refinery'){
        for(const [x,y,r,h] of [[-23,7,12,8],[4,10,10,5],[25,-12,7,19]]){cylinder(x,y,2,r,h,metal,12,.85);cylinder(x,y,h+2,r*.75,.12,rubber,12);}
        beam([-27,-18,3],[16,-9,5],1.7,metal[1]);beam([16,-9,5],[25,3,2],1.7,metal[1]);
      }else if(type==='battery'){
        for(const x of [-29,0,29])gun(x,-5,.25);for(let x=-38;x<=38;x+=8)bag(x,-29,1);
      }else{
        for(let i=0;i<5;i++){
          box(-base[0]*.43,(i-2)*base[1]*.18,2,3,base[1]*.18,4+[7,12,3,6,2][i],brick);
          box((i-2)*base[0]*.18,-base[1]*.43,2,base[0]*.18,3,4+[2,6,3,12,5][i],brick);
        }
      }
      for(let i=0;i<12;i++)chamfer((i%4-1.5)*base[0]*.2,(Math.floor(i/4)-1)*base[1]*.25,2,base[0]*.09,base[1]*.07,1+i%3,i%2?brick:rubber,i*.8,.4);
      if(type!=='refinery'&&type!=='battery')for(let i=0;i<3;i++)beam([-base[0]*.25+i*6,-base[1]*.2,3],[base[0]*.2+i*4,base[1]*.2,2],1.4,metal[1]);
      if(type==='industry'||type==='stack')chimney(-base[0]*.3,-base[1]*.2,base[2]*.45);
    }else if(state==='construction'&&!['tree','pine','infantry','tank','mech','artillery','bridge','trench'].includes(type)){
      box(0,0,0,base[0],base[1],2,stone);
      for(const x of [-.4,.4])for(const y of [-.4,.4])box(x*base[0],y*base[1],2,2,2,base[2]*.7,wood);
      for(const y of [-.4,.4])box(0,y*base[1],base[2]*.65,base[0]*.85,2,2,wood);
      crate(0,0,2);crate(10,0,2);crate(0,0,8);beam([-base[0]*.4,-base[1]*.4,2],[base[0]*.4,-base[1]*.4,base[2]*.65],1.2,wood[0]);
    }else switch(type){
      case 'infantry': {
        const uniform=side==='red'?['#a69774','#675d46','#847859']:['#85946b','#485f44','#647853'];
        const stride=options.pose==='march'?1:0;
        box(-.8,1+stride,0,1.5,2.2,1,rubber);box(.9,-.4-stride,0,1.5,2.2,1,rubber);
        box(-.8,.6+stride*.5,1,1.1,1.2,2.5,uniform);box(.9,-stride*.5,1,1.1,1.2,2.5,uniform);
        chamfer(0,0,3,3.3,2.2,2.9,uniform,0,.85);box(-.2,-1.35,3.6,2.5,1.2,2.2,wood);
        cylinder(0,0,6,1,1,['#c9af87','#8c7657','#b09870'],8);
        cylinder(0,0,6.8,1.5,.65,uniform,10,.65);cylinder(0,0,6.65,1.6,.2,uniform,10);
        beam([1,1,4.8],[3.4,1.4,4.4],.9,uniform[0]);beam([-.8,1,5],[2,2,4],.8,uniform[2]);
        beam([-.6,1.8,4.1],[5,1.8,4.5],.45,rubber[1]);
        if(detail){box(0,1.25,4.2,2.9,.35,.4,earth);box(-.6,1.5,3.4,.8,.6,.8,wood);box(.65,1.5,3.4,.8,.6,.8,wood);}
        break;
      }
      case 'tank':case 'mech': {
        const colors=ruin?['#64695b','#343e34','#4b5546']:paint;
        const tank=type==='tank',w=tank?20:18;
        if(tank){for(const y of [-4.6,4.6]){chamfer(0,y,.7,20,3,3.2,rubber,0,1);if(detail)for(let x=-7;x<=7;x+=3.5)wheel(x,y+Math.sign(y)*1.55,2.3,1.35);box(0,y,4.3,20,3.1,.6,colors);}}
        else for(const y of [-5,5])for(const x of [-6,0,6])wheel(x,y,2.2,2.2);
        chamfer(0,0,3,w,tank?8:9,tank?3.1:4.6,colors,0,.8);
        if(tank){const a=(options.turret||0)-(options.angle||0);chamfer(1,0,6.1,9,7.4,3.1,colors,a,.72);cylinder(0,0,9.2,1.5,.55,colors,10);beam([1,0,7.7],[1+Math.cos(a)*16,Math.sin(a)*16,8.2],1,colors[1]);const q=[1+Math.cos(a)*16,Math.sin(a)*16,8.2];box(q[0],q[1],q[2],2.1,1.5,1.1,colors,a);}
        else{box(4,0,7.2,4.3,7,2,colors);box(6.3,0,7.3,.4,5.8,1.3,rubber);cylinder(-2,0,7.6,1.8,.8,colors,10);for(const y of [-4.1,4.1])for(let x=-5;x<4;x+=3)box(x,y,5.6,1.5,.2,.7,rubber);}
        if(detail){for(let x=-7;x<=-3;x+=1.2)box(x,0,6.2, .4,5.6,.2,rubber);for(const y of [-2.3,2.3])box(w/2-.4,y,4.7,.5,1,.65,stone);crate(-6,0,tank?6.3:7.5,3.2,4,1.2);box(0,tank?3.65:4.05,4.3,3,.15,1,[mark,mark,mark]);if(tank){for(const y of [-4.6,4.6])for(let x=-8;x<=8;x+=2)box(x,y,4.95,.35,3.1,.1,rubber);cylinder(0,0,9.8,.8,.15,rubber,8);}}
        if(ruin){box(3,0,9,5,4,.2,rubber);beam([-6,-1,6],[-3,2,10],.6,'#292f29');}
        break;
      }
      case 'artillery':gun(0,0);break;
      case 'battery':
        box(0,0,0,90,70,1,earth);
        if(!ruin){for(const x of [-29,0,29])gun(x,-5,(options.turret||0)-(options.angle||0));for(let x=-38;x<=38;x+=8)bag(x,-29,1);for(const x of [-35,30]){crate(x,24,1,10,8,7);crate(x+8,24,1,5,8,4);}}break;
      case 'trench': {
        for(let i=0;i<8;i++){
          const x=-96+i*27,y=(i%4<2?0:12)-6;
          box(x,y,0,29,27,1.2,ruin?earth:rubber);
          for(const edge of [-1,1]){chamfer(x,y+edge*17,0,29,10,ruin?2:5,earth,0,.7);if(!ruin)box(x,y+edge*11,1,29,1,3,wood);}
          if(detail&&!ruin){for(let dx=-10;dx<=10;dx+=5)box(x+dx,y,1.3,3,17,.45,wood);for(const dx of [-11,11])box(x+dx,y+10,1,1.8,1.8,4.5,wood);if(i%2===0)for(let dx=-8;dx<=8;dx+=8)bag(x+dx,y-18,4);}
        }break;
      }
      case 'barracks':case 'house':case 'warehouse':case 'garage':case 'supply':case 'industry':case 'hq': {
        const [w,d,h]=base,body=type==='industry'?brick:stone;
        box(0,0,0,w+3,d+3,2.5,stone);
        box(0,0,2.5,w,d,h*.68,body);
        if(type==='industry'){
          for(let y=-d/2;y<d/2;y+=d/3){const high=h*.98;face([[-w/2,y,h*.7],[w/2,y,h*.7],[w/2,y+d/3,high],[-w/2,y+d/3,high]],metal[0]);face([[-w/2,y+d/3,high],[w/2,y+d/3,high],[w/2,y+d/3,h*.7],[-w/2,y+d/3,h*.7]],'#456b65');}
          chimney(-w*.35,-d*.3,h*1.6);doorway(w*.27,d/2+.3,15,17);
        }else if(type==='garage'){
          box(0,0,h*.7,w+2,d+2,2,metal);for(const x of [-24,0,24]){doorway(x,d/2+.4,18,17);box(x,d/2+1,18,20,2,2,paint);}for(const x of [-22,22])box(x,0,h*.7+2,10,12,3,metal);
        }else{
          const roofRise=Math.max(h*.3,d*.38);
          roof(0,0,h*.7,w+4,d+4,roofRise,type==='house'?brick:metal);
          if(type==='supply'){box(0,d/2+6,0,w,12,4,wood);for(const x of [-w*.32,0,w*.32])crate(x,d/2+5,4,12,8,8);box(0,d/2+6,h*.58,w,14,1,paint);for(const x of [-w*.44,w*.44])box(x,d/2+11,4,1,1,h*.58-4,wood);}
          else if(type==='hq'){box(-w*.3,-d*.1,h*.7,22,22,h*.55,stone);box(-w*.3,-d*.1,h*1.25,26,26,2,paint);beam([-w*.3,-d*.1,h*1.25],[-w*.3,-d*.1,h*1.8],.9,metal[1]);beam([-w*.3-9,-d*.1,h*1.6],[-w*.3+9,-d*.1,h*1.6],.7,metal[1]);}
          else if(type==='house')box(-w*.28,-d*.15,h*.7+roofRise*.65,4,5,h*.5,brick);
          doorway(0,d/2+.35,type==='warehouse'?14:8,type==='warehouse'?15:12);
          if(type==='barracks'){box(0,d/2+4,0,13,7,1,stone);box(0,d/2+2,1,11,4,1,stone);flag(w*.43,d*.45,h*1.2);}
        }
        if(detail){if(type!=='garage'&&type!=='supply')windows(0,d/2+.4,h*.4,w);for(const y of [-d*.28,d*.15])box(w/2+.25,y,h*.4,.4,6,6,rubber);if(type==='warehouse')for(let x=-w/2+3;x<w/2;x+=6)beam([x,0,h*.7+Math.max(h*.3,d*.38)],[x,d/2+2,h*.7],.3,stone[0]);}
        if(damaged){box(w*.17,0,h*.9,w*.28,d*.26,.3,rubber);beam([w*.1,d/2+.8,3],[w*.25,d/2+.8,h*.6],1.4,'#3c443a');crate(w*.55,d*.35,0,6,6,3);}
        break;
      }
      case 'refinery':
        box(0,0,0,80,55,2,stone);storage(-23,7,12,24);storage(4,10,10,20);storage(25,-12,7,47);
        box(-18,-19,2,30,11,12,brick);for(const x of [-28,-12,6]){beam([x,-18,15],[25,-18,15],1.6,metal[0]);beam([x,-18,15],[x,7,15],1.6,metal[0]);}if(detail){for(const z of [13,29,44]){box(25,-12,z,19,19,.8,metal);box(34,-12,z, .6,19,3,paint);}}break;
      case 'bridge': {
        for(const x of [-45,45])box(x,0,-16,8,19,16,stone);
        for(const x of [-48,-16,16,48])if(!ruin||Math.abs(x)>20)box(x,0,0,32,23,2.2,stone);
        for(const y of [-12,12]){for(let x=-64;x<64;x+=16){if(ruin&&x>=-16&&x<16)continue;beam([x,y,3],[x+16,y,3],1.2,metal[2]);beam([x,y,14],[x+16,y,14],1,metal[0]);beam([x,y,3],[x+16,y,14],1,metal[1]);beam([x,y,3],[x,y,14],1,metal[2]);}}
        if(detail&&!ruin)for(let x=-58;x<64;x+=13)box(x,0,2.3,6,.6,.05,earth);break;
      }
      case 'tree':case 'pine': {
        const leaves=['#819764','#3c6147','#5f7d51'];
        cylinder(0,0,0,1.7,24,wood,6,.6);
        if(type==='pine'){for(let i=0;i<4;i++)cylinder(0,0,12+i*7,12-i*2.3,14,leaves,7,.04);}
        else{for(const [x,y,z,r] of [[-5,1,18,9],[6,-2,22,10],[1,6,25,9],[-4,-4,30,8],[1,0,35,6]]){beam([0,0,15],[x,y,z],1.1,wood[1]);cylinder(x,y,z,r,r*.7,leaves,7,.45);cylinder(x,y,z-r*.5,r*.6,r*.5,leaves,7,1.65);}}break;
      }
      case 'crate':crate(-4,-2,0);crate(5,3,0);crate(-4,-2,6);break;
      case 'sandbags':for(let i=0;i<7;i++){const a=Math.PI*.1+i*Math.PI*.8/6,x=Math.cos(a)*17,y=Math.sin(a)*11;bag(x,y,0,a+Math.PI/2);bag(x+1,y,2,a+Math.PI/2);}break;
      case 'tank-store':storage(0,0,13,30);break;
      case 'stack':chimney(0,0,60);break;
      default:box(0,0,0,base[0],base[1],base[2],stone);
    }
    if(damaged){const w=base[0],d=base[1],h=base[2];box(w*.2,d*.48,Math.min(3,h*.3),w*.15,.3,h*.2,rubber);box(w*.4,d*.35,0,Math.max(2,w*.09),Math.max(2,d*.1),1.2,rubber,.4);}
    const ordered=orderFaces(faces);
    if(type!=='bridge'){
      const w=base[0]*.47,d=base[1]*.44,reach=base[2]*(ruin?.12:.38);
      ordered.unshift({color:'#132c2530',points:[[-w,-d,0],[w,-d,0],[w+reach,d+reach*.55,0],[-w+reach,d+reach*.55,0]].map(p=>point(...p))});
    }
    return ordered;
  }

  function project(p){return {x:(p[0]-p[1])*.84,y:(p[0]+p[1])*.42-p[2]};}
  // Average-depth sorting hides rear guns under their large concrete pad and clips
  // towers through roofs. Compare depth only where two projected faces overlap.
  // This runs when a sprite is built, never during an ordinary cached draw.
  function orderFaces(faces){
    const data=faces.map(face=>{
      const polygon=face.points.map(project),p=polygon[0],q=polygon[1],r=polygon[2];
      const depths=face.points.map(v=>v[0]+v[1]+v[2]*1.2);
      const det=(q.x-p.x)*(r.y-p.y)-(r.x-p.x)*(q.y-p.y);
      const a=det?((depths[1]-depths[0])*(r.y-p.y)-(depths[2]-depths[0])*(q.y-p.y))/det:0;
      const b=det?((q.x-p.x)*(depths[2]-depths[0])-(r.x-p.x)*(depths[1]-depths[0]))/det:0;
      return {face,polygon,det,a,b,c:depths[0]-a*p.x-b*p.y,depth:depths.reduce((n,v)=>n+v,0)/depths.length,
        minX:Math.min(...polygon.map(p=>p.x)),maxX:Math.max(...polygon.map(p=>p.x)),minY:Math.min(...polygon.map(p=>p.y)),maxY:Math.max(...polygon.map(p=>p.y)),edges:[],incoming:0};
    }).filter(f=>Math.abs(f.det)>.00001);
    function overlap(subject,clip){
      let result=subject;
      let area=0;for(let i=0;i<clip.length;i++){const a=clip[i],b=clip[(i+1)%clip.length];area+=a.x*b.y-b.x*a.y;}
      const sign=Math.sign(area);
      for(let i=0;i<clip.length&&result.length;i++){
        const a=clip[i],b=clip[(i+1)%clip.length],input=result;result=[];
        const distance=p=>sign*((b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x));
        for(let j=0;j<input.length;j++){
          const p=input[j],q=input[(j+1)%input.length],dp=distance(p),dq=distance(q);
          if(dp>=0)result.push(p);
          if((dp<0)!==(dq<0)){const t=dp/(dp-dq);result.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});}
        }
      }
      return result;
    }
    for(let i=0;i<data.length;i++)for(let j=i+1;j<data.length;j++){
      const a=data[i],b=data[j];if(a.maxX<=b.minX||b.maxX<=a.minX||a.maxY<=b.minY||b.maxY<=a.minY)continue;
      const intersect=overlap(a.polygon,b.polygon);if(intersect.length<3)continue;
      const p=intersect.reduce((p,v)=>({x:p.x+v.x/intersect.length,y:p.y+v.y/intersect.length}),{x:0,y:0});
      const delta=(a.a-b.a)*p.x+(a.b-b.b)*p.y+a.c-b.c;if(Math.abs(delta)<.001)continue;
      const before=delta<0?a:b,after=delta<0?b:a;before.edges.push(after);after.incoming++;
    }
    const remaining=new Set(data),ordered=[];
    while(remaining.size){
      let next=null;for(const f of remaining)if(!f.incoming&&(!next||f.depth<next.depth))next=f;
      // Intersecting authored parts can form cycles; resolve them deterministically.
      if(!next)for(const f of remaining)if(!next||f.depth<next.depth)next=f;
      ordered.push(next.face);remaining.delete(next);for(const f of next.edges)f.incoming--;
    }
    return ordered;
  }
  function bounds(mesh){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const face of mesh)for(const v of face.points){const p=project(v);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}return {minX,minY,maxX,maxY};}
  function paintMesh(ctx,mesh){for(const face of mesh){ctx.beginPath();face.points.forEach((v,i)=>{const p=project(v);if(i)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);});ctx.closePath();ctx.fillStyle=face.color;ctx.fill();}}
  const MAX_BYTES=16*1024*1024,MAX_ENTRIES=160;
  function createRenderer(makeCanvas=()=>document.createElement('canvas')){
    const cache=new Map();let bytes=0,hits=0,misses=0;
    function draw(ctx,type,x,y,unitScale=1,options={}){
      const steps=type==='infantry'?16:32,quantize=a=>Math.round((a||0)*steps/TAU)*TAU/steps;
      const rotatingUnit=['tank','mech','artillery','infantry'].includes(type);
      const opts={side:options.side||'blue',state:options.state||'intact',detail:options.detail!==false,angle:rotatingUnit?quantize(options.angle):(options.angle||0),turret:quantize(options.turret),w:options.w,d:options.d,h:options.h,pose:options.pose};
      const key=type+JSON.stringify(opts);let item=cache.get(key);
      if(item){hits++;cache.delete(key);cache.set(key,item);}else{
        misses++;const mesh=createMesh(type,opts),b=bounds(mesh),pad=2;
        // Higher close-up resolution for small models; large structures stay bounded.
        const density=Math.min(4,512/Math.max(b.maxX-b.minX+pad*2,b.maxY-b.minY+pad*2));
        const surface=makeCanvas();surface.width=Math.ceil((b.maxX-b.minX+pad*2)*density);surface.height=Math.ceil((b.maxY-b.minY+pad*2)*density);
        const c=surface.getContext('2d');c.setTransform(density,0,0,density,(-b.minX+pad)*density,(-b.minY+pad)*density);paintMesh(c,mesh);
        item={surface,x:b.minX-pad,y:b.minY-pad,w:surface.width/density,h:surface.height/density,bytes:surface.width*surface.height*4};
        while(cache.size&&(bytes+item.bytes>MAX_BYTES||cache.size>=MAX_ENTRIES)){const first=cache.keys().next().value;bytes-=cache.get(first).bytes;cache.delete(first);}
        cache.set(key,item);bytes+=item.bytes;
      }
      ctx.drawImage(item.surface,x+item.x*unitScale,y+item.y*unitScale,item.w*unitScale,item.h*unitScale);
    }
    return {draw,stats:()=>({entries:cache.size,bytes,hits,misses,maxBytes:MAX_BYTES}),clear(){cache.clear();bytes=0;}};
  }
  return {catalogue,sizes,createMesh,project,bounds,paintMesh,createRenderer};
});
