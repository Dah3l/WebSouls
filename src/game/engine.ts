import { GameState, Entity, Enemy, InputState, Vector2, Bonfire } from './types';

const PLAYER_SPEED = 2.5;
const PLAYER_ATTACK_DURATION = 25;
const PLAYER_DODGE_DURATION = 20;
const PLAYER_DODGE_SPEED = 5;
const STAMINA_REGEN_RATE = 0.3;
const STAMINA_ATTACK_COST = 25;
const STAMINA_DODGE_COST = 30;
const STAMINA_BLOCK_COST = 0.4;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 600;

export function createInitialState(level: number = 1): GameState {
  const player: Entity = {
    pos: { x: 100, y: 300 },
    vel: { x: 0, y: 0 },
    width: 24,
    height: 36,
    hp: 100,
    maxHp: 100,
    stamina: 100,
    maxStamina: 100,
    facing: 'right',
    state: 'idle',
    stateTimer: 0,
    invincible: false,
    invincibleTimer: 0,
    souls: 0,
    hitbox: null,
  };

  const bonfire: Bonfire = {
    pos: { x: 80, y: 320 },
    lit: true,
    animTimer: 0,
  };

  const enemies = createEnemies(level);

  return {
    player,
    enemies,
    particles: [],
    damageNumbers: [],
    bonfire,
    camera: { x: 0, y: 0 },
    souls: 0,
    totalSouls: 0,
    gameTime: 0,
    deaths: 0,
    bossDefeated: false,
    screenShake: 0,
    message: '',
    messageTimer: 0,
    phase: 'playing',
    level,
  };
}

function createEnemies(level: number): Enemy[] {
  const enemies: Enemy[] = [];
  
  if (level >= 1) {
    // Hollow soldiers
    enemies.push(createEnemy('hollow', 350, 320));
    enemies.push(createEnemy('hollow', 500, 280));
    enemies.push(createEnemy('hollow', 450, 380));
  }
  
  if (level >= 2) {
    enemies.push(createEnemy('knight', 700, 300));
    enemies.push(createEnemy('hollow', 750, 350));
  }
  
  if (level >= 3) {
    enemies.push(createEnemy('boss', 950, 280));
  }

  return enemies;
}

function createEnemy(type: 'hollow' | 'knight' | 'boss', x: number, y: number): Enemy {
  const configs = {
    hollow: { width: 20, height: 32, hp: 40, maxHp: 40, aggroRange: 150, attackRange: 35, attackCooldown: 60, souls: 50 },
    knight: { width: 24, height: 38, hp: 80, maxHp: 80, aggroRange: 180, attackRange: 40, attackCooldown: 80, souls: 150 },
    boss: { width: 40, height: 56, hp: 300, maxHp: 300, aggroRange: 400, attackRange: 55, attackCooldown: 100, souls: 1000 },
  };
  
  const config = configs[type];
  
  return {
    pos: { x, y },
    vel: { x: 0, y: 0 },
    width: config.width,
    height: config.height,
    hp: config.hp,
    maxHp: config.maxHp,
    stamina: 100,
    maxStamina: 100,
    facing: 'left',
    state: 'idle',
    stateTimer: 0,
    invincible: false,
    invincibleTimer: 0,
    souls: config.souls,
    hitbox: null,
    type,
    aggroRange: config.aggroRange,
    attackRange: config.attackRange,
    attackCooldown: config.attackCooldown,
    attackCooldownTimer: 0,
    patrolDir: 1,
    patrolTimer: 0,
    phase: type === 'boss' ? 1 : undefined,
    specialAttackTimer: type === 'boss' ? 200 : undefined,
  };
}

export function updateGame(state: GameState, input: InputState, dt: number): GameState {
  if (state.phase !== 'playing') return state;
  
  state.gameTime += dt;
  
  // Update player
  updatePlayer(state, input);
  
  // Update enemies
  state.enemies.forEach(enemy => {
    if (enemy.state !== 'dead') {
      updateEnemy(state, enemy);
    }
  });
  
  // Update particles
  updateParticles(state);
  
  // Update damage numbers
  state.damageNumbers = state.damageNumbers.filter(d => {
    d.pos.y -= 1;
    d.life -= dt;
    return d.life > 0;
  });
  
  // Update bonfire animation
  state.bonfire.animTimer += dt;
  
  // Update camera
  updateCamera(state);
  
  // Update screen shake
  if (state.screenShake > 0) state.screenShake -= dt;
  
  // Update message
  if (state.messageTimer > 0) state.messageTimer -= dt;
  
  // Check victory
  if (state.enemies.every(e => e.state === 'dead') && state.level >= 3) {
    state.bossDefeated = true;
    state.phase = 'victory';
  }
  
  // Level progression
  if (state.enemies.every(e => e.state === 'dead') && state.level < 3) {
    state.level++;
    state.enemies = createEnemies(state.level);
    state.player.pos = { x: 100, y: 300 };
    state.message = `Area ${state.level}`;
    state.messageTimer = 120;
  }
  
  // Stamina regen
  if (state.player.state !== 'attacking' && state.player.state !== 'dodging' && state.player.state !== 'blocking') {
    state.player.stamina = Math.min(state.player.maxStamina, state.player.stamina + STAMINA_REGEN_RATE);
  }
  
  // Invincibility frames
  if (state.player.invincibleTimer > 0) {
    state.player.invincibleTimer -= dt;
    if (state.player.invincibleTimer <= 0) {
      state.player.invincible = false;
    }
  }
  
  // Check death
  if (state.player.hp <= 0 && state.player.state !== 'dead') {
    state.player.state = 'dead';
    state.player.stateTimer = 120;
    state.deaths++;
    setTimeout(() => {
      state.phase = 'dead';
    }, 2000);
  }
  
  // Rest at bonfire
  if (input.keys.has('e') || input.keys.has('E')) {
    const dist = distance(state.player.pos, state.bonfire.pos);
    if (dist < 50 && state.player.state === 'idle') {
      state.player.hp = state.player.maxHp;
      state.player.stamina = state.player.maxStamina;
      state.message = 'Rested at Bonfire';
      state.messageTimer = 90;
      // Reset enemies
      state.enemies = createEnemies(state.level);
      state.player.pos = { x: 100, y: 300 };
    }
  }
  
  return state;
}

function updatePlayer(state: GameState, input: InputState) {
  const player = state.player;
  
  if (player.state === 'dead') return;
  
  // Handle state transitions
  if (player.stateTimer > 0) {
    player.stateTimer--;
    
    if (player.state === 'attacking' && player.stateTimer <= 0) {
      player.state = 'idle';
      player.hitbox = null;
    }
    if (player.state === 'dodging' && player.stateTimer <= 0) {
      player.state = 'idle';
      player.invincible = false;
    }
    if (player.state === 'hurt' && player.stateTimer <= 0) {
      player.state = 'idle';
    }
    
    // Apply dodge movement
    if (player.state === 'dodging') {
      const dir = player.facing === 'right' ? 1 : -1;
      player.pos.x += PLAYER_DODGE_SPEED * dir;
    }
    
    // Attack hitbox active frames
    if (player.state === 'attacking' && player.stateTimer > 10 && player.stateTimer < 20) {
      const dir = player.facing === 'right' ? 1 : -1;
      player.hitbox = {
        x: player.pos.x + (dir > 0 ? player.width : -30),
        y: player.pos.y - 5,
        w: 30,
        h: player.height + 10,
      };
      
      // Check hits on enemies
      state.enemies.forEach(enemy => {
        if (enemy.state !== 'dead' && !enemy.invincible) {
          if (rectsOverlap(player.hitbox!, { x: enemy.pos.x, y: enemy.pos.y, w: enemy.width, h: enemy.height })) {
            const damage = 20 + Math.floor(Math.random() * 10);
            enemy.hp -= damage;
            enemy.state = 'hurt';
            enemy.stateTimer = 15;
            enemy.invincible = true;
            enemy.invincibleTimer = 20;
            
            state.damageNumbers.push({
              pos: { x: enemy.pos.x + enemy.width / 2, y: enemy.pos.y },
              value: damage,
              life: 40,
              color: '#ffffff',
            });
            
            spawnHitParticles(state, enemy.pos.x + enemy.width / 2, enemy.pos.y + enemy.height / 2);
            state.screenShake = 5;
            
            if (enemy.hp <= 0) {
              enemy.state = 'dead';
              state.souls += enemy.souls;
              state.totalSouls += enemy.souls;
              state.message = `+${enemy.souls} Souls`;
              state.messageTimer = 60;
              spawnDeathParticles(state, enemy.pos.x + enemy.width / 2, enemy.pos.y + enemy.height / 2);
            }
          }
        }
      });
    } else {
      player.hitbox = null;
    }
    
    return; // Can't act during states
  }
  
  // Blocking
  if (input.rightMouseDown && player.stamina > 5) {
    player.state = 'blocking';
    player.stamina -= STAMINA_BLOCK_COST;
    return;
  } else if (player.state === 'blocking') {
    player.state = 'idle';
  }
  
  // Attack
  if ((input.attackPressed || input.keys.has(' ')) && player.stamina >= STAMINA_ATTACK_COST) {
    player.state = 'attacking';
    player.stateTimer = PLAYER_ATTACK_DURATION;
    player.stamina -= STAMINA_ATTACK_COST;
    input.attackPressed = false;
    return;
  }
  
  // Dodge
  if ((input.dodgePressed || input.keys.has('Shift')) && player.stamina >= STAMINA_DODGE_COST) {
    player.state = 'dodging';
    player.stateTimer = PLAYER_DODGE_DURATION;
    player.stamina -= STAMINA_DODGE_COST;
    player.invincible = true;
    player.invincibleTimer = PLAYER_DODGE_DURATION;
    input.dodgePressed = false;
    
    // Dodge particles
    for (let i = 0; i < 5; i++) {
      state.particles.push({
        pos: { x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 },
        vel: { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 },
        life: 15,
        maxLife: 15,
        color: '#8888ff',
        size: 3,
      });
    }
    return;
  }
  
  // Movement
  let dx = 0, dy = 0;
  if (input.keys.has('a') || input.keys.has('A') || input.keys.has('ArrowLeft')) dx -= 1;
  if (input.keys.has('d') || input.keys.has('D') || input.keys.has('ArrowRight')) dx += 1;
  if (input.keys.has('w') || input.keys.has('W') || input.keys.has('ArrowUp')) dy -= 1;
  if (input.keys.has('s') || input.keys.has('S') || input.keys.has('ArrowDown')) dy += 1;
  
  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
    
    player.pos.x += dx * PLAYER_SPEED;
    player.pos.y += dy * PLAYER_SPEED;
    
    if (dx > 0) player.facing = 'right';
    if (dx < 0) player.facing = 'left';
    
    player.state = 'walking';
  } else {
    player.state = 'idle';
  }
  
  // Clamp to world
  player.pos.x = Math.max(0, Math.min(WORLD_WIDTH - player.width, player.pos.x));
  player.pos.y = Math.max(100, Math.min(WORLD_HEIGHT - player.height - 50, player.pos.y));
}

function updateEnemy(state: GameState, enemy: Enemy) {
  if (enemy.invincibleTimer > 0) {
    enemy.invincibleTimer--;
    if (enemy.invincibleTimer <= 0) enemy.invincible = false;
  }
  
  if (enemy.stateTimer > 0) {
    enemy.stateTimer--;
    
    if (enemy.state === 'hurt' && enemy.stateTimer <= 0) {
      enemy.state = 'idle';
    }
    
    if (enemy.state === 'attacking') {
      // Attack hitbox active
      if (enemy.stateTimer > 15 && enemy.stateTimer < 25) {
        const dir = enemy.facing === 'right' ? 1 : -1;
        const hitbox = {
          x: enemy.pos.x + (dir > 0 ? enemy.width : -enemy.attackRange),
          y: enemy.pos.y,
          w: enemy.attackRange,
          h: enemy.height,
        };
        
        const playerBox = { x: state.player.pos.x, y: state.player.pos.y, w: state.player.width, h: state.player.height };
        
        if (rectsOverlap(hitbox, playerBox) && !state.player.invincible) {
          if (state.player.state === 'blocking') {
            // Blocked
            state.player.stamina -= 20;
            state.damageNumbers.push({
              pos: { x: state.player.pos.x, y: state.player.pos.y - 10 },
              value: 0,
              life: 30,
              color: '#88aaff',
            });
            state.screenShake = 3;
          } else {
            const damage = enemy.type === 'boss' ? 30 : enemy.type === 'knight' ? 20 : 12;
            state.player.hp -= damage;
            state.player.state = 'hurt';
            state.player.stateTimer = 15;
            state.player.invincible = true;
            state.player.invincibleTimer = 30;
            
            state.damageNumbers.push({
              pos: { x: state.player.pos.x + state.player.width / 2, y: state.player.pos.y },
              value: damage,
              life: 40,
              color: '#ff4444',
            });
            
            spawnHitParticles(state, state.player.pos.x + state.player.width / 2, state.player.pos.y + state.player.height / 2);
            state.screenShake = 8;
          }
        }
      }
      
      if (enemy.stateTimer <= 0) {
        enemy.state = 'idle';
        enemy.attackCooldownTimer = enemy.attackCooldown;
      }
    }
    
    return;
  }
  
  // Cooldown
  if (enemy.attackCooldownTimer > 0) {
    enemy.attackCooldownTimer--;
  }
  
  const dist = distance(enemy.pos, state.player.pos);
  
  // Boss special attacks
  if (enemy.type === 'boss' && enemy.specialAttackTimer !== undefined) {
    enemy.specialAttackTimer--;
    if (enemy.specialAttackTimer <= 0) {
      // Leap attack
      enemy.state = 'attacking';
      enemy.stateTimer = 35;
      enemy.specialAttackTimer = 150 + Math.floor(Math.random() * 100);
      
      // Boss phase 2
      if (enemy.hp < enemy.maxHp * 0.5 && enemy.phase === 1) {
        enemy.phase = 2;
        enemy.attackCooldown = 60;
        state.message = 'The Knight enrages!';
        state.messageTimer = 90;
      }
      return;
    }
  }
  
  // AI
  if (dist < enemy.aggroRange) {
    // Chase player
    const dx = state.player.pos.x - enemy.pos.x;
    const dy = state.player.pos.y - enemy.pos.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len > 0) {
      enemy.facing = dx > 0 ? 'right' : 'left';
      
      if (dist > enemy.attackRange) {
        const speed = enemy.type === 'boss' ? 1.5 : enemy.type === 'knight' ? 1.2 : 1;
        enemy.pos.x += (dx / len) * speed;
        enemy.pos.y += (dy / len) * speed;
        enemy.state = 'walking';
      } else if (enemy.attackCooldownTimer <= 0) {
        // Attack
        enemy.state = 'attacking';
        enemy.stateTimer = enemy.type === 'boss' ? 35 : 25;
      }
    }
  } else {
    // Patrol
    enemy.patrolTimer++;
    if (enemy.patrolTimer > 60) {
      enemy.patrolDir *= -1;
      enemy.patrolTimer = 0;
    }
    enemy.pos.x += enemy.patrolDir * 0.5;
    enemy.facing = enemy.patrolDir > 0 ? 'right' : 'left';
    enemy.state = 'walking';
    
    // Clamp
    enemy.pos.x = Math.max(50, Math.min(WORLD_WIDTH - enemy.width - 50, enemy.pos.x));
  }
  
  // Clamp Y
  enemy.pos.y = Math.max(100, Math.min(WORLD_HEIGHT - enemy.height - 50, enemy.pos.y));
}

function updateParticles(state: GameState) {
  state.particles = state.particles.filter(p => {
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;
    p.vel.y += 0.1;
    p.life--;
    return p.life > 0;
  });
}

function updateCamera(state: GameState) {
  const targetX = state.player.pos.x - 400;
  const targetY = state.player.pos.y - 300;
  state.camera.x += (targetX - state.camera.x) * 0.05;
  state.camera.y += (targetY - state.camera.y) * 0.05;
  state.camera.x = Math.max(0, Math.min(WORLD_WIDTH - 800, state.camera.x));
  state.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - 500, state.camera.y));
}

function spawnHitParticles(state: GameState, x: number, y: number) {
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      pos: { x, y },
      vel: { x: (Math.random() - 0.5) * 4, y: (Math.random() - 0.5) * 4 - 2 },
      life: 20 + Math.random() * 10,
      maxLife: 30,
      color: Math.random() > 0.5 ? '#ff6644' : '#ffaa22',
      size: 2 + Math.random() * 3,
    });
  }
}

function spawnDeathParticles(state: GameState, x: number, y: number) {
  for (let i = 0; i < 20; i++) {
    state.particles.push({
      pos: { x, y },
      vel: { x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6 - 3 },
      life: 40 + Math.random() * 20,
      maxLife: 60,
      color: ['#ff4444', '#ff8844', '#ffcc44', '#ffffff'][Math.floor(Math.random() * 4)],
      size: 3 + Math.random() * 4,
    });
  }
}

function distance(a: Vector2, b: Vector2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
