export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  pos: Vector2;
  vel: Vector2;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  facing: 'left' | 'right';
  state: EntityState;
  stateTimer: number;
  invincible: boolean;
  invincibleTimer: number;
  souls: number;
  hitbox: { x: number; y: number; w: number; h: number } | null;
}

export type EntityState = 
  | 'idle' 
  | 'walking' 
  | 'attacking' 
  | 'dodging' 
  | 'blocking'
  | 'hurt' 
  | 'dead'
  | 'casting';

export interface Enemy extends Entity {
  type: 'hollow' | 'knight' | 'boss';
  aggroRange: number;
  attackRange: number;
  attackCooldown: number;
  attackCooldownTimer: number;
  patrolDir: number;
  patrolTimer: number;
  phase?: number;
  specialAttackTimer?: number;
}

export interface Particle {
  pos: Vector2;
  vel: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface DamageNumber {
  pos: Vector2;
  value: number;
  life: number;
  color: string;
}

export interface Bonfire {
  pos: Vector2;
  lit: boolean;
  animTimer: number;
}

export interface GameState {
  player: Entity;
  enemies: Enemy[];
  particles: Particle[];
  damageNumbers: DamageNumber[];
  bonfire: Bonfire;
  camera: Vector2;
  souls: number;
  totalSouls: number;
  gameTime: number;
  deaths: number;
  bossDefeated: boolean;
  screenShake: number;
  message: string;
  messageTimer: number;
  phase: 'menu' | 'playing' | 'dead' | 'victory';
  level: number;
}

export interface InputState {
  keys: Set<string>;
  mouseDown: boolean;
  rightMouseDown: boolean;
  mouseX: number;
  mouseY: number;
  attackPressed: boolean;
  dodgePressed: boolean;
}
