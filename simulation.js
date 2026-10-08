(function (root, factory) {
  const api = factory(typeof module === 'object' && module.exports ? require('./fog.js') : root.Fog);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Frontiers = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Fog) {
  'use strict';
  const WORLD = { width: 920, depth: 680, river: 450, bridges: [210, 490] };
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  function height(x, y) {
    if (Math.abs(x - WORLD.river) < 22) return -3;
    return 5 + 30 * Math.exp(-(((x - 735) / 150) ** 2 + ((y - 165) / 140) ** 2)) +
      10 * Math.exp(-(((x - 215) / 155) ** 2 + ((y - 485) / 160) ** 2));
  }
  function terrain(x, y) {
    if ((x - 630) ** 2 / 100 ** 2 + (y - 160) ** 2 / 90 ** 2 < 1) return 'forest';
    if (height(x, y) > 22) return 'hill';
    return 'open';
  }
  function route(from, to) {
    to = { x: clamp(to.x, 35, 885), y: clamp(to.y, 35, 645) };
    if (Math.abs(to.x - 450) < 28) {
      const bridge = WORLD.bridges.reduce((a, b) => Math.abs(a - to.y) < Math.abs(b - to.y) ? a : b);
      to.y = bridge;
    }
    if ((from.x < 450) !== (to.x < 450)) {
      const bridge = WORLD.bridges.reduce((a, b) => Math.abs(from.y - a) + Math.abs(to.y - a) < Math.abs(from.y - b) + Math.abs(to.y - b) ? a : b);
      const sign = from.x < 450 ? 1 : -1;
      return [{ x: 450 - sign * 55, y: bridge }, { x: 450 + sign * 55, y: bridge }, to];
    }
    return [to];
  }
  function formation(id, name, side, type, x, y) {
    return { id, name, side, type, x, y, home: { x, y }, hp: side === 'blue' ? 120 : 85,
      maxHp: side === 'blue' ? 120 : 85, angle: side === 'blue' ? 0 : Math.PI, turret: side === 'blue' ? 0 : Math.PI,
      range: type === 'mech' ? 145 : 180, speed: type === 'mech' ? 36 : 30, damage: type === 'mech' ? 7 : 10,
      cooldown: 0, order: 'hold', path: [], targetId: null, moving: false, status: 'Holding position', aiTimer: 0 };
  }
  function create() {
    return { time: 0, paused: false, materiel: 120, incomeClock: 0, selected: 'a', winner: null, capture: 0,
      factory: { x: 755, y: 365, hp: 200, maxHp: 200, owner: 'red', repair: false },
      depot: { x: 145, y: 335 }, events: [], shots: [], wrecks: [],
      units: [formation('a', 'A Company', 'blue', 'tank', 210, 220), formation('b', 'B Company', 'blue', 'mech', 180, 355), formation('c', 'C Company', 'blue', 'tank', 255, 495),
        formation('r1', 'Woodland guard', 'red', 'mech', 610, 160), formation('r2', 'Steelworks guard', 'red', 'tank', 685, 350), formation('r3', 'Southern reserve', 'red', 'tank', 730, 525)] };
  }
  function emit(state, message, source) { state.events.push({ time: state.time, message, visibleToPlayer: !source || !state.fog || source.side === 'blue' || source.owner === 'blue' || Fog.visible(state, source.x, source.y) }); if (state.events.length > 8) state.events.shift(); }
  const routeFor = (state, from, to) => (state.map?.route || route)(from, to);
  const terrainFor = (state, x, y) => (state.map?.terrain || terrain)(x, y);
  function command(state, id, order, destination, options = {}) {
    const u = state.units.find(u => u.id === id && u.side === 'blue' && u.hp > 0);
    if (!u || state.winner === 'red') return false;
    if (order === 'attack' && !state.units.some(e => e.id === destination && e.side !== u.side && e.hp > 0)) return false;
    const queue=Boolean(options.queue)&&['move','advance'].includes(order);
    const waiting=u.commandQueue||[];
    if(queue&&waiting.length>=32)return false;
    const origin=queue?(waiting.at(-1)?.destination||u.path.at(-1)||u):u;
    const repairSites=order==='repair'?(state.buildings?.filter(b=>b.owner==='blue'&&b.type==='supply'&&b.hp>0&&!b.remaining&&state.regions.find(r=>r.id===state.map.regionAt(b.x,b.y)?.id)?.supplied)||[]):[];
    const repairTarget=order==='repair'?[state.depot,...repairSites].reduce((a,b)=>distance(u,a)<distance(u,b)?a:b):null;
    const target = order === 'repair' ? repairTarget : order === 'attack' ? state.units.find(e => e.id === destination) : destination;
    const planned = order === 'hold' ? [] : target ? routeFor(state, origin, target) : [];
    if (order !== 'hold' && !planned.length) return false;
    if(queue&&(u.path.length||waiting.length)){u.commandQueue=[...waiting,{order,destination:{x:destination.x,y:destination.y}}];emit(state,u.name+': waypoint queued.',u);return true;}
    if(!queue){u.commandQueue=[];delete u.blockedQueueRevision;}
    u.order = order; u.targetId = null;
    if (order === 'hold') { u.path = []; u.velocity=0; u.status = 'Holding position'; }
    else if (order === 'repair') { u.repairTarget={x:repairTarget.x,y:repairTarget.y};u.path = planned; u.status = 'Returning to depot'; }
    else if (order === 'attack') {
      const enemy = state.units.find(e => e.id === destination && e.side !== u.side && e.hp > 0);
      if (!enemy) return false;
      u.targetId = enemy.id; u.path = planned; u.status = 'Advancing on defenders';
    } else { u.order = order === 'move' ? 'move' : 'advance'; u.path = planned; u.status = order === 'move' ? 'Moving · disengaging from combat' : 'Advancing'; }
    emit(state, `${u.name}: ${u.status.toLowerCase()}.`, u); return true;
  }
  function formationPlan(units,destination,lineEnd){
    if(!units.length)return [];
    let slots;
    if(lineEnd&&units.length>1){slots=units.map((u,i)=>({x:destination.x+(lineEnd.x-destination.x)*i/(units.length-1),y:destination.y+(lineEnd.y-destination.y)*i/(units.length-1)}));}
    else {const centre={x:units.reduce((n,u)=>n+u.x,0)/units.length,y:units.reduce((n,u)=>n+u.y,0)/units.length},extent=Math.max(1,...units.map(u=>distance(u,centre))),compression=Math.min(1,160/extent);slots=units.map(u=>({x:destination.x+(u.x-centre.x)*compression,y:destination.y+(u.y-centre.y)*compression}));
      if(slots.some((p,i)=>slots.some((q,j)=>i!==j&&distance(p,q)<75))){const columns=Math.ceil(Math.sqrt(units.length)),rows=Math.ceil(units.length/columns);slots=units.map((u,i)=>({x:destination.x+(i%columns-(columns-1)/2)*85,y:destination.y+(Math.floor(i/columns)-(rows-1)/2)*85}));}}
    return units.map(u=>{let best=0;for(let i=1;i<slots.length;i++)if(distance(u,slots[i])<distance(u,slots[best]))best=i;return {id:u.id,goal:slots.splice(best,1)[0]};});
  }
  function closestEnemy(state, u, maxDistance = Infinity, requireClearFire = false) {
    let target = null, best = maxDistance;
    for (const v of state.units) if (v.side !== u.side && v.hp > 0) { const d = distance(u, v); if (d < best) { if(requireClearFire&&u.type!=='artillery'&&state.map?.lineOfFire&&!state.map.lineOfFire(u,v)){u.fireBlocked=true;continue;} best = d; target = v; } }
    return target;
  }
  function trenchAt(state,u){if(u.type!=='infantry'||u.moving)return null;return (state.buildings||[]).find(b=>{if(b.type!=='trench'||b.owner!==u.side||b.hp<=0||b.remaining)return false;const a=b.angle||0,dx=u.x-b.x,dy=u.y-b.y;return Math.abs(dx*Math.cos(a)+dy*Math.sin(a))<=110&&Math.abs(-dx*Math.sin(a)+dy*Math.cos(a))<=38;})||null;}
  function trenchCover(state,u){return Boolean(trenchAt(state,u));}

  const terrainModifiers={open:{name:'Open ground',damage:1,speed:1},forest:{name:'Forest',damage:.75,speed:.75},hill:{name:'Hillside',damage:.9,speed:.92},ridge:{name:'Ridge cover',damage:.8,speed:.85},valley:{name:'Valley',damage:1,speed:1},marsh:{name:'Marsh',damage:1,speed:.6},water:{name:'Water',damage:1,speed:1}};
  function damageMultiplier(state,u){const t=terrainFor(state,u.x,u.y);return (terrainModifiers[t]?.damage??1)*(trenchCover(state,u)?.5:1);}
  function impact(state,target,damage,facility=false){const before=target.hp;target.hp=Math.max(0,target.hp-damage);if(target.hp===0&&before>0){if(facility)emit(state,(target.name||'Facility')+' destroyed.',target);else{state.wrecks.push({x:target.x,y:target.y,angle:target.angle,type:target.type});if(state.wrecks.length>180)state.wrecks.shift();emit(state,target.name+' destroyed.',target);}if(state.explosions){state.explosions.push({x:target.x,y:target.y,ttl:2,total:2,size:45});if(state.explosions.length>96)state.explosions.shift();}}}
  function fire(state,u,target,facility=false){
    const damage=(facility?30:u.damage*(.4+.6*u.hp/u.maxHp)*(u.type==='artillery'?1:damageMultiplier(state,target)))*(.4+.6*(u.supply??1));u.turret=Math.atan2(target.y-u.y,target.x-u.x);
    if(u.type==='artillery'&&state.shells){if(state.shells.length<96){const flight=.8+distance(u,target)/550;state.shells.push({x:u.x,y:u.y,tx:target.x,ty:target.y,side:u.side,remaining:flight,total:flight,damage:facility?65:damage,radius:95});}}
    else {impact(state,target,damage,facility);state.shots.push({x:u.x,y:u.y,tx:target.x,ty:target.y,side:u.side,ttl:.42,facility});if(state.shots.length>160)state.shots.shift();if(state.explosions){state.explosions.push({x:target.x,y:target.y,ttl:.55,total:.55,size:8});if(state.explosions.length>96)state.explosions.shift();}}
  }
  function effects(state,dt){if(!state.shells)return;for(const e of state.explosions)e.ttl-=dt;state.explosions=state.explosions.filter(e=>e.ttl>0);for(const shell of state.shells){shell.remaining-=dt;if(shell.remaining>0)continue;const point={x:shell.tx,y:shell.ty};for(const u of state.units)if(u.hp>0&&u.side!==shell.side&&distance(u,point)<shell.radius)impact(state,u,shell.damage*(1-distance(u,point)/shell.radius*.7)*damageMultiplier(state,u));for(const b of [...state.facilities,...state.buildings,...state.bridges])if(b.hp>0&&b.owner!==shell.side&&distance(b,point)<shell.radius)impact(state,b,shell.damage*1.4,true);state.explosions.push({x:point.x,y:point.y,ttl:1.7,total:1.7,size:shell.radius>100?85:38});state.craters.push({...point,size:18});if(state.craters.length>120)state.craters.shift();}state.shells=state.shells.filter(s=>s.remaining>0);if(state.explosions.length>96)state.explosions.splice(0,state.explosions.length-96);}
  function bombard(state, id, factory = state.factory) {
    const name=factory.name||'Steelworks';
    const u = state.units.find(u => u.id === id && u.hp > 0 && u.side === 'blue');
    if (state.paused) return 'Resume the battle to fire.';
    if (!u || distance(u, factory) > (u.type==='artillery'?u.range:245)) return 'Move the selected formation within firing range of the '+name.toLowerCase()+'.';
    if(u.type!=='artillery'&&state.map?.lineOfFire&&!state.map.lineOfFire(u,factory))return 'Ridge blocks direct fire. Reposition or use artillery.';
    if (factory.owner === 'blue') return name+' is under your control.';
    if (factory.hp <= 0) return name+' already disabled.';
    if (u.cooldown > 0) return 'Reloading. Try again shortly.';
    fire(state, u, factory, true); u.cooldown = u.type==='artillery'?5:1.8;
    return 'Strike fired. Infrastructure damage is permanent until repaired.';
  }
  function fireMission(state,id,point){const u=state.units.find(u=>u.id===id&&u.side==='blue'&&u.hp>0&&u.type==='artillery');if(!u)return 'Select artillery.';if(state.paused)return 'Resume to fire.';if(u.cooldown>0)return 'Battery reloading.';if(distance(u,point)>u.range)return 'Target beyond artillery range.';if(!state.map.land(point.x,point.y))return 'Target land or a river crossing.';fire(state,u,{...point,hp:1,side:'red'});u.cooldown=5;return 'Fire mission launched.';}
  function repairFactory(state, factory = state.factory) {
    if (factory.owner !== 'blue') return 'Capture the facility first.';
    if (factory.hp >= factory.maxHp) return 'Facility already operational.';
    factory.repair = !factory.repair;
    return factory.repair ? 'Engineers assigned: repairs consume materiel over time.' : 'Repairs paused.';
  }
  function move(state,u,dt){
    if(!u.path.length){u.velocity=0;return;}
    let goal=u.path[0],d=distance(u,goal);
    // Skip only waypoints with a clear navigable segment; bridge corners remain protected.
    if(state.map&&u.path.length>1&&d<55&&state.map.visible(u,u.path[1])){u.path.shift();goal=u.path[0];d=distance(u,goal);}
    const terrain=terrainFor(state,u.x,u.y),maximum=u.speed*(terrainModifiers[terrain]?.speed??1)*(u.type==='infantry'?1:.35+.65*(u.fuel??1));
    const wanted=Math.atan2(goal.y-u.y,goal.x-u.x),delta=Math.atan2(Math.sin(wanted-u.angle),Math.cos(wanted-u.angle));
    u.angle+=clamp(delta,-3.6*dt,3.6*dt);
    const acceleration=u.speed*3,remaining=u.path.length===1?d:Infinity;
    const desired=Math.min(maximum,Math.sqrt(2*acceleration*remaining))*(Math.abs(delta)>1.3?.45:1);
    u.velocity=(u.velocity||0)+clamp(desired-(u.velocity||0),-acceleration*dt,acceleration*dt);
    const step=u.velocity*dt;
    const next=d?{x:u.x+(goal.x-u.x)/d*Math.min(step,d),y:u.y+(goal.y-u.y)/d*Math.min(step,d)}:goal;if(state.map&&!state.map.walkable(next.x,next.y)){const end=u.path.at(-1);u.path=state.map.route(u,end);u.velocity=0;u.status='Route blocked · awaiting crossing';return;}
    if(d<step+.1){u.x=goal.x;u.y=goal.y;u.path.shift();if(!u.path.length)u.velocity=0;}
    else {u.x+=(goal.x-u.x)/d*step;u.y+=(goal.y-u.y)/d*step;}
    u.moving=true;
  }
  function step(state, dt) {
    if (state.paused || state.winner === 'red') return;
    dt = clamp(dt, 0, .1); state.time += dt;effects(state,dt);
    for (const shot of state.shots) shot.ttl -= dt;
    state.shots = state.shots.filter(s => s.ttl > 0);
    for (const u of state.units) {
      if (u.hp <= 0) { u.moving = false; continue; }
      u.cooldown = Math.max(0, u.cooldown - dt); u.moving = false;
      if (u.side === 'red') {
        u.aiTimer -= dt;
        if (u.aiTimer <= 0) {
          u.aiTimer = .8;
          const intruder = closestEnemy(state, u, 290);
          if (u.hp < u.maxHp*.25) { const safe=state.regions?.filter(r=>r.owner==='red').reduce((a,r)=>!a||distance(u,r)<distance(u,a)?r:a,null);u.path = routeFor(state, u, safe|| (state.map ? u.home : { x: 840, y: u.home.y })); u.order = 'withdraw'; }
          else if (intruder && (state.map || intruder.x > 400) && distance(u, intruder) > u.range * .9 && u.type !== 'mech' && u.type !== 'artillery') { u.path = routeFor(state, u, intruder); u.order = 'advance'; }
          else if (u.objective) { if (!u.path.length) u.path = routeFor(state, u, u.objective); u.order = 'advance'; }
          else { u.path = []; u.order = 'hold'; }
        }
      }
      if(u.side==='blue'&&!u.path.length&&u.commandQueue?.length){
        const revision=state.map?.revision?.()??'static';
        if(u.blockedQueueRevision!==revision){const next=u.commandQueue[0],planned=routeFor(state,u,next.destination);if(planned.length){u.path=planned;u.order=next.order;u.targetId=null;u.commandQueue.shift();delete u.blockedQueueRevision;}else u.blockedQueueRevision=revision;}
      }
      u.fireBlocked=false;
      const enemy = closestEnemy(state, u, u.range, true);
      const retreating = u.order === 'repair' || u.order === 'withdraw';
      const relocating = u.order === 'move' && u.path.length > 0;
      if (enemy && !retreating && !relocating) {
        u.velocity=0;
        u.status = 'Engaging ' + enemy.name; u.turret = Math.atan2(enemy.y - u.y, enemy.x - u.x);
        if (u.cooldown <= 0) { fire(state, u, enemy); u.cooldown = u.type==='artillery'?5:u.type === 'tank' ? 1.65 : 1.1; }
      } else if (u.path.length) { move(state, u, dt); u.turret = u.angle; u.status = retreating ? 'Withdrawing' : relocating ? 'Moving · disengaging from combat' : 'Advancing'; }
      else { u.velocity=0;u.status = u.commandQueue?.length ? 'Queued route blocked · awaiting crossing' : u.order === 'repair' ? 'Refitting at depot' : u.fireBlocked ? 'Ridge blocks direct fire · reposition or use artillery' : 'Holding position'; }
      if (u.order === 'repair' && distance(u, u.repairTarget||state.depot) < 45 && u.hp < u.maxHp) {
        const healing = Math.min(7 * dt, u.maxHp - u.hp, state.materiel / .6);
        u.hp += healing; state.materiel -= healing * .6;
        u.status = state.materiel < .1 ? 'Awaiting materiel' : 'Repairing at depot';
        if (u.hp >= u.maxHp - .01) { u.order = 'hold'; u.status = 'Repaired · ready for orders'; }
      }
    }
    for (const factory of state.facilities || [state.factory]) {
      factory.capture ??= state.capture || 0;
    if (!state.territory && factory.owner !== 'blue') {
      const friendly = state.units.some(u => u.side === 'blue' && u.hp > 0 && distance(u, factory) < 115);
      const defended = state.units.some(u => u.side === 'red' && u.hp > 0 && distance(u, factory) < 155);
      if (friendly && !defended) factory.capture = Math.min(100, factory.capture + dt * 10);
      else if (!friendly) factory.capture = Math.max(0, factory.capture - dt * 3);
      if (factory.capture >= 100) { factory.owner = 'blue'; if (!state.facilities) state.winner = 'blue'; emit(state, (factory.regionName||state.regionName||'Greywater')+' secured. Production is now under your control.'); }
    }
    if (factory.owner === 'blue') {
      state.materiel += dt * (factory.production ?? 1.4) * factory.hp / factory.maxHp;
      if (factory.repair && factory.hp < factory.maxHp) {
        const healed = Math.min(8 * dt, factory.maxHp - factory.hp, state.materiel / .8);
        factory.hp += healed; state.materiel -= healed * .8;
        if (factory.hp >= factory.maxHp) factory.repair = false;
      }
    }
    }
    if (!state.facilities) state.capture = state.factory.capture;
    if (!state.regional && !state.units.some(u => u.side === 'blue' && u.hp > 0)) { state.winner = 'red'; emit(state, 'Your assault force has been lost. Restart to try a different approach.'); }
  }
  return { terrainModifiers, WORLD, formationPlan, formation, create, step, command, bombard, fireMission, repairFactory, height, terrain, route, distance, clamp, trenchCover, trenchAt };
});
