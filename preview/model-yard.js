(() => {
  'use strict';
  const M=FrontierModels,$=id=>document.getElementById(id),canvas=$('model');
  let selected='tank',group='All';
  function options(){return {side:$('side').value,state:$('condition').value,angle:Number($('rotation').value)*Math.PI/180,turret:Number($('rotation').value)*Math.PI/180,detail:$('detail').checked};}
  function render(c,type,opts,thumbnail=false){
    const width=c.clientWidth,height=c.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
    c.width=Math.round(width*dpr);c.height=Math.round(height*dpr);
    const ctx=c.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
    const mesh=M.createMesh(type,opts),bounds=M.bounds(mesh),w=bounds.maxX-bounds.minX,h=bounds.maxY-bounds.minY;
    const scale=Math.min(width*(thumbnail?.76:.72)/w,height*(thumbnail?.72:.77)/h);
    const ox=width/2-(bounds.minX+bounds.maxX)/2*scale,oy=height*.48-(bounds.minY+bounds.maxY)/2*scale;
    // Inspection-only floor; the model mesh is the same one used by the game cache.
    ctx.strokeStyle='#93a78918';ctx.lineWidth=1;
    for(let i=-8;i<=8;i++){
      const y=height*.69+i*16;ctx.beginPath();ctx.moveTo(0,y-width*.25);ctx.lineTo(width,y+width*.25);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,y+width*.25);ctx.lineTo(width,y-width*.25);ctx.stroke();
    }
    ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);
    M.paintMesh(ctx,mesh);ctx.restore();
  }
  function update(){
    const item=M.catalogue.find(m=>m.id===selected);
    $('model-name').textContent=item.name;$('category').textContent=item.group;$('description').textContent=item.description;
    $('position').textContent=(M.catalogue.indexOf(item)+1)+' / '+M.catalogue.length;
    $('degrees').textContent=$('rotation').value+'°';
    canvas.setAttribute('aria-label',item.name+', '+$('condition').selectedOptions[0].textContent+', '+$('rotation').value+' degrees');
    render(canvas,selected,options());
    for(const button of $('roster').children)button.setAttribute('aria-pressed',String(button.dataset.model===selected));
  }
  function select(id){
    selected=id;
    const condition=$('condition'),staticOnly=['infantry','tree','pine','crate','sandbags','tank-store','stack'].includes(id);
    condition.disabled=staticOnly;
    for(const o of condition.options)o.disabled=(id==='tank'||id==='mech'||id==='artillery'||id==='bridge'||id==='trench')&&o.value==='construction';
    if(condition.disabled||condition.selectedOptions[0].disabled)condition.value='intact';
    update();
  }
  function roster(){
    $('roster').replaceChildren();
    for(const item of M.catalogue.filter(m=>group==='All'||m.group===group)){
      const button=document.createElement('button');button.dataset.model=item.id;button.setAttribute('aria-label','Inspect '+item.name);
      const c=document.createElement('canvas');c.setAttribute('aria-hidden','true');const name=document.createElement('strong');name.textContent=item.name;
      const kind=document.createElement('small');kind.textContent=item.group;button.append(c,name,kind);button.onclick=()=>select(item.id);$('roster').append(button);
      render(c,item.id,{side:'blue',detail:true},true);
    }
    $('count').textContent=$('roster').children.length+' models';update();
  }
  for(const id of ['rotation','side','condition','detail'])$(id).addEventListener('input',update);
  for(const button of document.querySelectorAll('[data-group]'))button.onclick=()=>{group=button.dataset.group;document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));roster();};
  new ResizeObserver(()=>{roster();}).observe(document.querySelector('.inspection'));
  roster();select(selected);
})();
