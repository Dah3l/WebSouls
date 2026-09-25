import { GameState, Entity, Enemy, InputState, Vector2, Bonfire } from './types';

const PLAYER_SPEED = 2.8;
const PLAYER_ATTACK_DURATION = 22;
const PLAYER_DODGE_DURATION = 18;
const PLAYER_DODGE_SPEED = 5.5;
const STAMINA_REGEN_RATE = 0.35;
const STAMINA_ATTACK_COST = 22;
const STAMINA_DODGE_COST = 28;
const STAMINA_BLOCK_COST = 0.3;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 600;
const BLOCK_BUFFER_FRAMES = 8; // Frames where block is still considered active

export function createInitialState(level: number = 1): GameState {
  const player: Entity = {
    pos: { x: 100, y: 350 },
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
    pos: { x: 80, y: 370 },
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
    enemies.push(createEnemy('hollow', 350, 350));
    enemies.push(createEnemy('hollow', 500, 320));
    enemies.push(createEnemy('hollow', 450, 400));
  }
  
  if (level >= 2) {
    enemies.push(createEnemy('knight', 700, 340));
    enemies.push(createEnemy('hollow', 750, 380));
  }
  
  if (level >= 3) {
    enemies.push(createEnemy('boss', 950, 320));
  }

  return enemies;
}

function createEnemy(type: 'hollow' | 'knight' | 'boss', x: number, y: number): Enemy {
  const configs = {
    hollow: { width: 20, height: 32, hp: 40, maxHp: 40, aggroRange: 160, attackRange: 35, attackCooldown: 70, souls: 50 },
    knight: { width: 24, height: 38, hp: 80, maxHp: 80, aggroRange: 190, attackRange: 42, attackCooldown: 90, souls: 150 },
    boss: { width: 40, height: 56, hp: 300, maxHp: 300, aggroRange: 500, attackRange: 60, attackCooldown: 100, souls: 1000 },
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

// Track block buffer per player
let blockBuffer = 0;
let wasBlocking = false;

export function updateGame(state: GameState, input: InputState, dt: number): GameState {
  if (state.phase !== 'playing') return state;
  
  state.gameTime += dt;
  
  updatePlayer(state, input, dt);
  
  state.enemies.forEach(enemy => {
    if (enemy.state !== 'dead') {
      updateEnemy(state, enemy, dt);
    }
  });
  
  updateParticles(state);
  
  state.damageNumbers = state.damageNumbers.filter(d => {
    d.pos.y -= 1.2;
    d.life -= dt;
    return d.life > 0;
  });
  
  state.bonfire.animTimer += dt;
  
  updateCamera(state);
  
  if (state.screenShake > 0) state.screenShake -= dt * 0.5;
  if (state.messageTimer > 0) state.messageTimer -= dt;
  
  if (state.enemies.every(e => e.state === 'dead') && state.level >= 3) {
    state.bossDefeated = true;
    state.phase = 'victory';
  }
  
  if (state.enemies.every(e => e.state === 'dead') && state.level < 3) {
    state.level++;
    state.enemies = createEnemies(state.level);
    state.player.pos = { x: 100, y: 350 };
    state.message = `— Area ${state.level} —`;
    state.messageTimer = 120;
  }
  
  // Stamina regen (only when not attacking, dodging, or blocking)
  if (state.player.state !== 'attacking' && state.player.state !== 'dodging' && state.player.state !== 'blocking') {
    state.player.stamina = Math.min(state.player.maxStamina, state.player.stamina + STAMINA_REGEN_RATE * dt);
  }
  
  // Invincibility frames countdown
  if (state.player.invincibleTimer > 0) {
    state.player.invincibleTimer -= dt;
    if (state.player.invincibleTimer <= 0) {
      state.player.invincible = false;
      state.player.invincibleTimer = 0;
    }
  }
  
  // Block buffer countdown
  if (blockBuffer > 0) {
    blockBuffer -= dt;
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
    if (dist < 60 && state.player.state === 'idle') {
      state.player.hp = state.player.maxHp;
      state.player.stamina = state.player.maxStamina;
      state.message = 'Rested at Bonfire';
      state.messageTimer = 90;
      state.enemies = createEnemies(state.level);
      state.player.pos = { x: 100, y: 350 };
      // Consume the key press
      input.keys.delete('e');
      input.keys.delete('E');
    }
  }
  
  return state;
}

function updatePlayer(state: GameState, input: InputState, dt: number) {
  const player = state.player;
  
  if (player.state === 'dead') return;
  
  // Track blocking state for buffer
  const isBlocking = input.rightMouseDown && player.stamina > 5;
  if (isBlocking && !wasBlocking) {
    blockBuffer = BLOCK_BUFFER_FRAMES;
  }
  wasBlocking = isBlocking;
  
  // Handle state timers
  if (player.stateTimer > 0) {
    player.stateTimer -= dt;
    
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
      player.pos.x += PLAYER_DODGE_SPEED * dir * dt;
    }
    
    // Attack hitbox active frames (roughly middle portion of attack)
    if (player.state === 'attacking') {
      const attackProgress = PLAYER_ATTACK_DURATION - player.stateTimer;
      if (attackProgress > 5 && attackProgress < 18) {
        const dir = player.facing === 'right' ? 1 : -1;
        player.hitbox = {
          x: player.pos.x + (dir > 0 ? player.width : -32),
          y: player.pos.y - 5,
          w: 32,
          h: player.height + 10,
        };
        
        // Check hits on enemies (only once per enemy using invincible flag)
        state.enemies.forEach(enemy => {
          if (enemy.state !== 'dead' && !enemy.invincible) {
            if (rectsOverlap(player.hitbox!, { x: enemy.pos.x, y: enemy.pos.y, w: enemy.width, h: enemy.height })) {
              const damage = 20 + Math.floor(Math.random() * 10);
              enemy.hp -= damage;
              enemy.state = 'hurt';
              enemy.stateTimer = 15;
              enemy.invincible = true;
              enemy.invincibleTimer = 25;
              
              // Knockback
              const knockDir = player.facing === 'right' ? 1 : -1;
              enemy.pos.x += knockDir * 8;
              
              state.damageNumbers.push({
                pos: { x: enemy.pos.x + enemy.width / 2, y: enemy.pos.y - 5 },
                value: damage,
                life: 45,
                color: '#ffffff',
              });
              
              spawnHitParticles(state, enemy.pos.x + enemy.width / 2, enemy.pos.y + enemy.height / 2);
              state.screenShake = 6;
              
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
    }
    
    // Can still block during hurt state (recovery)
    if (player.state === 'hurt' && isBlocking) {
      player.stamina -= STAMINA_BLOCK_COST * dt;
    }
    
    // Can't move during attack/dodge/hurt
    clampPlayerPosition(player);
    return;
  }
  
  // === FREE STATE - can act ===
  
  // Blocking (highest priority movement-wise)
  if (isBlocking) {
    player.state = 'blocking';
    player.stamina -= STAMINA_BLOCK_COST * dt;
    
    // Can still slowly move while blocking
    let dx = 0, dy = 0;
    if (input.keys.has('a') || input.keys.has('A') || input.keys.has('ArrowLeft')) dx -= 1;
    if (input.keys.has('d') || input.keys.has('D') || input.keys.has('ArrowRight')) dx += 1;
    if (input.keys.has('w') || input.keys.has('W') || input.keys.has('ArrowUp')) dy -= 1;
    if (input.keys.has('s') || input.keys.has('S') || input.keys.has('ArrowDown')) dy += 1;
    
    if (dx !== 0 || dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      player.pos.x += (dx / len) * PLAYER_SPEED * 0.4;
      player.pos.y += (dy / len) * PLAYER_SPEED * 0.4;
      if (dx > 0) player.facing = 'right';
      if (dx < 0) player.facing = 'left';
    }
    
    clampPlayerPosition(player);
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
    clampPlayerPosition(player);
    return;
  }
  
  // Dodge
  if ((input.dodgePressed || input.keys.has('Shift')) && player.stamina >= STAMINA_DODGE_COST) {
    player.state = 'dodging';
    player.stateTimer = PLAYER_DODGE_DURATION;
    player.stamina -= STAMINA_DODGE_COST;
    player.invincible = true;
    player.invincibleTimer = PLAYER_DODGE_DURATION + 2;
    input.dodgePressed = false;
    
    // Dodge particles
    for (let i = 0; i < 6; i++) {
      state.particles.push({
        pos: { x: player.pos.x + player.width / 2, y: player.pos.y + player.height / 2 },
        vel: { x: (Math.random() - 0.5) * 3, y: (Math.random() - 0.5) * 3 },
        life: 15,
        maxLife: 15,
        color: '#6688ff',
        size: 3,
      });
    }
    clampPlayerPosition(player);
    return;
  }
  
  // Movement - use normalized diagonal movement
  let dx = 0, dy = 0;
  if (input.keys.has('a') || input.keys.has('A') || input.keys.has('ArrowLeft')) dx -= 1;
  if (input.keys.has('d') || input.keys.has('D') || input.keys.has('ArrowRight')) dx += 1;
  if (input.keys.has('w') || input.keys.has('W') || input.keys.has('ArrowUp')) dy -= 1;
  if (input.keys.has('s') || input.keys.has('S') || input.keys.has('ArrowDown')) dy += 1;
  
  if (dx !== 0 || dy !== 0) {
    // Normalize diagonal movement
    const len = Math.sqrt(dx * dx + dy * dy);
    dx /= len;
    dy /= len;
    
    player.pos.x += dx * PLAYER_SPEED * dt;
    player.pos.y += dy * PLAYER_SPEED * dt;
    
    // Update facing based on horizontal movement
    if (dx > 0.1) player.facing = 'right';
    else if (dx < -0.1) player.facing = 'left';
    
    player.state = 'walking';
  } else {
    if (player.state === 'walking') {
      player.state = 'idle';
    }
  }
  
  clampPlayerPosition(player);
}

function clampPlayerPosition(player: Entity) {
  player.pos.x = Math.max(20, Math.min(WORLD_WIDTH - player.width - 20, player.pos.x));
  player.pos.y = Math.max(150, Math.min(WORLD_HEIGHT - player.height - 60, player.pos.y));
}

function updateEnemy(state: GameState, enemy: Enemy, dt: number) {
  if (enemy.invincibleTimer > 0) {
    enemy.invincibleTimer--;
    if (enemy.invincibleTimer <= 0) enemy.invincible = false;
  }
  
  if (enemy.stateTimer > 0) {
    enemy.stateTimer -= dt;
    
    if (enemy.state === 'hurt' && enemy.stateTimer <= 0) {
      enemy.state = 'idle';
    }
    
    if (enemy.state === 'attacking') {
      // Attack hitbox active frames
      const attackProgress = (enemy.type === 'boss' ? 35 : 25) - enemy.stateTimer;
      if (attackProgress > 10 && attackProgress < 22) {
        const dir = enemy.facing === 'right' ? 1 : -1;
        const hitbox = {
          x: enemy.pos.x + (dir > 0 ? enemy.width : -enemy.attackRange),
          y: enemy.pos.y + 5,
          w: enemy.attackRange,
          h: enemy.height - 10,
        };
        
        const playerBox = { x: state.player.pos.x, y: state.player.pos.y, w: state.player.width, h: state.player.height };
        
        if (rectsOverlap(hitbox, playerBox) && !state.player.invincible && state.player.state !== 'dead') {
          // Check if player is blocking (with buffer)
          const isPlayerBlocking = state.player.state === 'blocking' || blockBuffer > 0;
          
          if (isPlayerBlocking && state.player.stamina > 0) {
            // Successfully blocked!
            const blockCost = enemy.type === 'boss' ? 30 : enemy.type === 'knight' ? 22 : 15;
            state.player.stamina -= blockCost;
            
            state.damageNumbers.push({
              pos: { x: state.player.pos.x + state.player.width / 2, y: state.player.pos.y - 15 },
              value: 0,
              life: 35,
              color: '#88aaff',
            });
            
            // Block spark particles
            for (let i = 0; i < 5; i++) {
              state.particles.push({
                pos: { x: state.player.pos.x + state.player.width / 2, y: state.player.pos.y + state.player.height / 3 },
                vel: { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 - 2 },
                life: 15,
                maxLife: 15,
                color: '#aaccff',
                size: 2 + Math.random() * 2,
              });
            }
            
            state.screenShake = 4;
            
            // Guard break if stamina depleted
            if (state.player.stamina <= 0) {
              state.player.stamina = 0;
              state.player.state = 'hurt';
              state.player.stateTimer = 30;
              state.message = 'Guard Broken!';
              state.messageTimer = 60;
            }
            
            // Mark attack as "consumed" so it doesn't hit again
            enemy.stateTimer = 0;
          } else {
            // Player gets hit
            const damage = enemy.type === 'boss' ? (enemy.phase === 2 ? 35 : 25) : enemy.type === 'knight' ? 18 : 10;
            state.player.hp -= damage;
            state.player.state = 'hurt';
            state.player.stateTimer = 18;
            state.player.invincible = true;
            state.player.invincibleTimer = 35;
            
            // Knockback player
            const knockDir = enemy.facing === 'right' ? 1 : -1;
            state.player.pos.x += knockDir * 12;
            
            state.damageNumbers.push({
              pos: { x: state.player.pos.x + state.player.width / 2, y: state.player.pos.y - 5 },
              value: damage,
              life: 45,
              color: '#ff4444',
            });
            
            spawnHitParticles(state, state.player.pos.x + state.player.width / 2, state.player.pos.y + state.player.height / 2);
            state.screenShake = 10;
            
            // Mark attack as consumed
            enemy.stateTimer = 0;
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
    enemy.attackCooldownTimer -= dt;
  }
  
  const dist = distance(enemy.pos, state.player.pos);
  
  // Boss special attacks
  if (enemy.type === 'boss' && enemy.specialAttackTimer !== undefined) {
    enemy.specialAttackTimer -= dt;
    if (enemy.specialAttackTimer <= 0) {
      enemy.state = 'attacking';
      enemy.stateTimer = 35;
      enemy.specialAttackTimer = enemy.phase === 2 ? 100 + Math.floor(Math.random() * 60) : 150 + Math.floor(Math.random() * 100);
      
      if (enemy.hp < enemy.maxHp * 0.5 && enemy.phase === 1) {
        enemy.phase = 2;
        enemy.attackCooldown = 55;
        state.message = '— The King enrages! —';
        state.messageTimer = 90;
        state.screenShake = 15;
      }
      return;
    }
  }
  
  // AI behavior
  if (dist < enemy.aggroRange && state.player.state !== 'dead') {
    const dx = state.player.pos.x - enemy.pos.x;
    const dy = state.player.pos.y - enemy.pos.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    
    if (len > 0) {
      enemy.facing = dx > 0 ? 'right' : 'left';
      
      if (dist > enemy.attackRange) {
        const speed = enemy.type === 'boss' ? (enemy.phase === 2 ? 2 : 1.5) : enemy.type === 'knight' ? 1.3 : 1;
        enemy.pos.x += (dx / len) * speed * dt;
        enemy.pos.y += (dy / len) * speed * dt;
        enemy.state = 'walking';
      } else if (enemy.attackCooldownTimer <= 0) {
        enemy.state = 'attacking';
        enemy.stateTimer = enemy.type === 'boss' ? 35 : 25;
      }
    }
  } else {
    // Patrol
    enemy.patrolTimer += dt;
    if (enemy.patrolTimer > 60) {
      enemy.patrolDir *= -1;
      enemy.patrolTimer = 0;
    }
    enemy.pos.x += enemy.patrolDir * 0.5 * dt;
    enemy.facing = enemy.patrolDir > 0 ? 'right' : 'left';
    enemy.state = 'walking';
    
    enemy.pos.x = Math.max(50, Math.min(WORLD_WIDTH - enemy.width - 50, enemy.pos.x));
  }
  
  enemy.pos.y = Math.max(150, Math.min(WORLD_HEIGHT - enemy.height - 60, enemy.pos.y));
}

function updateParticles(state: GameState) {
  state.particles = state.particles.filter(p => {
    p.pos.x += p.vel.x;
    p.pos.y += p.vel.y;
    p.vel.y += 0.12;
    p.life--;
    return p.life > 0;
  });
}

function updateCamera(state: GameState) {
  const viewWidth = 800;
  const viewHeight = 500;
  const targetX = state.player.pos.x - viewWidth / 2;
  const targetY = state.player.pos.y - viewHeight / 2;
  state.camera.x += (targetX - state.camera.x) * 0.08;
  state.camera.y += (targetY - state.camera.y) * 0.08;
  state.camera.x = Math.max(0, Math.min(WORLD_WIDTH - viewWidth, state.camera.x));
  state.camera.y = Math.max(0, Math.min(WORLD_HEIGHT - viewHeight, state.camera.y));
}

function spawnHitParticles(state: GameState, x: number, y: number) {
  for (let i = 0; i < 8; i++) {
    state.particles.push({
      pos: { x, y },
      vel: { x: (Math.random() - 0.5) * 5, y: (Math.random() - 0.5) * 5 - 2 },
      life: 20 + Math.random() * 10,
      maxLife: 30,
      color: Math.random() > 0.5 ? '#ff6644' : '#ffaa22',
      size: 2 + Math.random() * 3,
    });
  }
}

function spawnDeathParticles(state: GameState, x: number, y: number) {
  for (let i = 0; i < 25; i++) {
    state.particles.push({
      pos: { x, y },
      vel: { x: (Math.random() - 0.5) * 7, y: (Math.random() - 0.5) * 7 - 3 },
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
