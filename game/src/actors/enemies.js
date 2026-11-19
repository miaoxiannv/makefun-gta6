import * as THREE from 'three';
import { ENEMIES } from '../config.js';
import { approachAngle, makeRng } from '../core/rng.js';
import { PersonModel } from './person-model.js';

const CREW_LOOK = { skin: '#c98a5e', shirt: '#7a1e1e', print: null, pants: '#23232a', shoes: '#1d1d1f', hair: '#14100c', shades: false };
const BOSS_LOOK = { skin: '#8a5a3b', shirt: '#ff2211', print: null, pants: '#14141a', shoes: '#1d1d1f', hair: '#0c0a08', shades: true };

class Enemy {
  constructor(scene, rng, x, z, boss = false) {
    this.model = new PersonModel(boss ? BOSS_LOOK : CREW_LOOK);
    this.position = this.model.root.position;
    this.position.set(x, 0, z);
    this.boss = boss;
    this.health = boss ? ENEMIES.bossHealth : ENEMIES.health;
    this.maxHealth = this.health;
    this.speed = ENEMIES.speed * (boss ? 0.9 : 1);
    this.heading = rng.range(0, Math.PI * 2);
    this.phase = rng.range(0, Math.PI * 2);
    this.state = 'idle';
    this.attackTimer = rng.range(0, 0.5);
    this.staggerTimer = 0;
    this.downTimer = 0;
    this.knock = { x: 0, z: 0 };
    this.gait = 0;
    scene.add(this.model.root);
  }

  get x() { return this.position.x; }
  get z() { return this.position.z; }
  get alive() { return this.state !== 'down'; }

  walkToward(dt, heading, speed) {
    this.heading = approachAngle(this.heading, heading, 8 * dt);
    this.position.x += Math.sin(this.heading) * speed * dt;
    this.position.z += Math.cos(this.heading) * speed * dt;
  }

  hit(damage, kx, kz) {
    if (this.state === 'down') return false;
    this.health -= damage;
    this.knock.x += kx;
    this.knock.z += kz;
    if (this.health <= 0) {
      this.state = 'down';
      this.downTimer = 2.5;
      return true;
    }
    this.state = 'stagger';
    this.staggerTimer = ENEMIES.stagger;
    return false;
  }

  update(dt, time, world, player, onPlayerHit) {
    
    if (this.state === 'down') {
      this.downTimer -= dt;
      this.position.x += this.knock.x * dt;
      this.position.z += this.knock.z * dt;
      this.knock.x *= Math.exp(-4 * dt);
      this.knock.z *= Math.exp(-4 * dt);
      this.gait = 0;
    } else if (this.state === 'stagger') {
      this.staggerTimer -= dt;
      this.position.x += this.knock.x * dt;
      this.position.z += this.knock.z * dt;
      this.knock.x *= Math.exp(-4 * dt);
      this.knock.z *= Math.exp(-4 * dt);
      this.gait = 0;
      if (this.staggerTimer <= 0) this.state = 'chase';
    } else {
      const dx = player.position.x - this.position.x;
      const dz = player.position.z - this.position.z;
      const d = Math.hypot(dx, dz);
      if (this.state === 'idle' && d < ENEMIES.aggro) this.state = 'chase';
      if (this.state === 'chase') {
        if (d > ENEMIES.attackRange) {
          this.walkToward(dt, Math.atan2(dx, dz), this.speed);
          this.gait = 1;
        } else {
          
          this.gait = 0;
          this.attackTimer -= dt;
          if (this.attackTimer <= 0) {
            this.attackTimer = ENEMIES.attackCooldown;
            this.position.x += (dx / Math.max(d, 0.01)) * 0.4;
            this.position.z += (dz / Math.max(d, 0.01)) * 0.4;
            if (Math.hypot(player.position.x - this.position.x, player.position.z - this.position.z) < ENEMIES.attackRange + 0.4) {
              onPlayerHit(this.boss ? ENEMIES.bossDamage : ENEMIES.damage);
            }
          }
        }
      } else {
        this.gait = 0;
      }
    }

    world.resolveCircle(this.position, 0.4);
    this.position.y = world.groundHeight(this.position.x, this.position.z);
    this.phase += dt * (this.gait > 0 ? this.speed : 0) * 2.1;
    this.model.pose(this.phase, this.gait, false, time);
    if (this.state === 'down') {
      this.model.torso.rotation.x = 0.85;
      this.model.head.rotation.x = 0.4;
      this.model.hips.position.y = 0.6;
    }
    this.model.root.rotation.y = this.heading;
  }
}

export class Enemies {
  constructor(scene) {
    this.scene = scene;
    this.list = [];
  }

  spawn(count, cx, cz, { boss = false } = {}) {
    const rng = makeRng((Math.floor(cx * 13 + cz * 7) >>> 0) + count * 101 + (boss ? 5 : 0));
    for (let k = 0; k < count; k += 1) {
      const a = rng.range(0, Math.PI * 2);
      const d = rng.range(7, 15);
      const enemy = new Enemy(this.scene, rng, cx + Math.cos(a) * d, cz + Math.sin(a) * d, boss && k === count - 1);
      enemy.model.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      this.list.push(enemy);
    }
  }

  update(dt, time, world, player, onPlayerHit) {
    for (const enemy of this.list) enemy.update(dt, time, world, player, onPlayerHit);
    
    for (const enemy of [...this.list]) {
      if (enemy.state === 'down' && enemy.downTimer <= 0) {
        this.scene.remove(enemy.model.root);
        this.list.splice(this.list.indexOf(enemy), 1);
      }
    }
  }

  get alive() {
    return this.list.filter((e) => e.alive);
  }

  clearAll() {
    for (const enemy of this.list) this.scene.remove(enemy.model.root);
    this.list = [];
  }

  pushOut(p, radius) {
    for (const enemy of this.list) {
      if (!enemy.alive) continue;
      const dx = p.x - enemy.position.x;
      const dz = p.z - enemy.position.z;
      const d = Math.hypot(dx, dz);
      const min = radius + 0.4;
      if (d < min && d > 1e-6) {
        p.x += (dx / d) * (min - d);
        p.z += (dz / d) * (min - d);
      }
    }
  }
}