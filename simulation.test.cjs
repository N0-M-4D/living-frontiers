const assert = require('node:assert/strict');
const F = require('./simulation.js');
let checks = 0;
function test(name, fn) { fn(); checks++; console.log(`PASS ${name}`); }
function run(s, seconds) { for (let i = 0; i < seconds * 20; i++) F.step(s, .05); }
test('Cross-river orders route through the closest bridge', () => {
  for (const [from, to, expected] of [[{ x: 200, y: 140 }, { x: 700, y: 160 }, 210], [{ x: 700, y: 520 }, { x: 200, y: 550 }, 490]]) {
    const route = F.route(from, to); assert.equal(route[0].y, expected); assert.equal(route[1].y, expected); assert.notEqual(route[0].x < 450, route[1].x < 450);
  }
});
test('Pause freezes combat and orders resume after unpausing', () => { const s = F.create(); s.paused = true; F.command(s, 'a', 'advance', { x: 300, y: 200 }); run(s, 5); assert.equal(s.time, 0); assert.equal(s.units[0].x, 210); s.paused = false; run(s, 1); assert.ok(s.units[0].x > 210); });
test('Hold clears a movement order', () => { const s = F.create(); F.command(s, 'a', 'advance', { x: 350, y: 200 }); F.command(s, 'a', 'hold'); run(s, 1); assert.equal(s.units[0].x, 210); });
test('Depot repairs cost materiel and stop at full health', () => { const s = F.create(), u = s.units[0]; Object.assign(u, s.depot, { hp: 60 }); F.command(s, 'a', 'repair'); run(s, 20); assert.equal(u.hp, u.maxHp); assert.ok(Math.abs(s.materiel - 84) < .01); });
test('Defenders contest capture; surviving attackers can secure the factory', () => { const s = F.create(); Object.assign(s.units[0], { x: 755, y: 365 }); run(s, .5); assert.equal(s.capture, 0); s.units.filter(u => u.side === 'red').forEach(u => u.hp = 0); run(s, 11); assert.equal(s.winner, 'blue'); assert.equal(s.factory.owner, 'blue'); });
test('Bombardment requires range, consumes a reload and damages infrastructure', () => { const s = F.create(); F.bombard(s, 'a'); assert.equal(s.factory.hp, 200); Object.assign(s.units[0], { x: 650, y: 365 }); F.bombard(s, 'a'); assert.equal(s.factory.hp, 170); F.bombard(s, 'a'); assert.equal(s.factory.hp, 170); });
test('Captured ruined factory can be rebuilt at a resource cost', () => { const s = F.create(); s.factory.owner = 'blue'; s.factory.hp = 0; F.repairFactory(s); run(s, 2); assert.ok(s.factory.hp > 0); assert.ok(s.materiel < 120); });
test('Combat effects expire, dead units do not fight and defeat is reported', () => { const s = F.create(); Object.assign(s.units[0], { x: 650, y: 350 }); run(s, 3); assert.ok(s.units[0].hp < 120); assert.ok(s.shots.length < 20); s.units.filter(u => u.side === 'blue').forEach(u => u.hp = 0); run(s, .1); assert.equal(s.winner, 'red'); });
test('Simulation is deterministic without any renderer or camera', () => { const a = F.create(), b = F.create(); for (const s of [a, b]) { F.command(s, 'a', 'advance', { x: 755, y: 365 }); F.command(s, 'b', 'advance', { x: 705, y: 320 }); run(s, 90); } assert.deepEqual(a, b); });
test('The coordinated opening assault can win without changing health or teleporting', () => { const s = F.create(); for (const id of ['a', 'b', 'c']) F.command(s, id, 'advance', s.factory); run(s, 180); assert.equal(s.winner, 'blue'); assert.ok(s.units.some(u => u.side === 'blue' && u.hp > 0 && u.hp < u.maxHp)); });
console.log(`${checks} checks passed.`);
