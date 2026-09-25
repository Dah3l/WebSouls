import { GameState, Entity, Enemy, Bonfire, Particle, DamageNumber } from './types';

const TILE_SIZE = 16;

export function renderGame(ctx: CanvasRenderingContext2D, state: GameState, canvasWidth: number, canvasHeight: number) {
  ctx.imageSmoothingEnabled = false;
  
  // Screen shake
  let shakeX = 0, shakeY = 0;
  if (state.screenShake > 0) {
    shakeX = (Math.random() - 0.5) * state.screenShake * 2;
    shakeY = (Math.random() - 0.5) * state.screenShake * 2;
  }
  
  ctx.save();
  ctx.translate(shakeX, shakeY);
  
  // Clear
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Camera transform
  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);
  
  // Draw background
  drawBackground(ctx, state);
  
  // Draw bonfire
  drawBonfire(ctx, state.bonfire);
  
  // Draw enemies
  state.enemies.forEach(enemy => {
    if (enemy.state !== 'dead') {
      drawEnemy(ctx, enemy, state.gameTime);
    }
  });
  
  // Draw player
  drawPlayer(ctx, state.player, state.gameTime);
  
  // Draw particles
  state.particles.forEach(p => drawParticle(ctx, p));
  
  // Draw damage numbers
  state.damageNumbers.forEach(d => drawDamageNumber(ctx, d));
  
  ctx.restore();
  
  // Draw UI
  drawUI(ctx, state, canvasWidth, canvasHeight);
  
  // Draw messages
  if (state.messageTimer > 0) {
    drawMessage(ctx, state.message, canvasWidth, canvasHeight);
  }
  
  // Draw death screen
  if (state.phase === 'dead') {
    drawDeathScreen(ctx, canvasWidth, canvasHeight);
  }
  
  // Draw victory screen
  if (state.phase === 'victory') {
    drawVictoryScreen(ctx, canvasWidth, canvasHeight);
  }
  
  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState) {
  // Dark stone floor
  const startX = Math.floor(state.camera.x / TILE_SIZE) * TILE_SIZE;
  const startY = Math.floor(state.camera.y / TILE_SIZE) * TILE_SIZE;
  const endX = startX + 850;
  const endY = startY + 550;
  
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 600);
  grad.addColorStop(0, '#0a0a15');
  grad.addColorStop(0.6, '#12121f');
  grad.addColorStop(1, '#1a1a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1200, 600);
  
  // Stone tiles
  for (let x = startX; x < endX; x += TILE_SIZE) {
    for (let y = startY; y < endY; y += TILE_SIZE) {
      if (y > 400) {
        // Floor
        const shade = ((x + y) % 32 === 0) ? '#2a2a35' : '#222230';
        ctx.fillStyle = shade;
        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
        
        // Floor detail
        if ((x * 7 + y * 13) % 64 === 0) {
          ctx.fillStyle = '#1a1a25';
          ctx.fillRect(x + 4, y + 4, 4, 4);
        }
      } else if (y > 350) {
        // Transition
        ctx.fillStyle = '#181825';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }
  
  // Walls/pillars
  drawPillar(ctx, 200, 150);
  drawPillar(ctx, 600, 130);
  drawPillar(ctx, 900, 160);
  
  // Decorative elements
  drawTorch(ctx, 300, 200, state.gameTime);
  drawTorch(ctx, 700, 180, state.gameTime);
  drawTorch(ctx, 1050, 200, state.gameTime);
  
  // Chains on walls
  for (let i = 0; i < 3; i++) {
    const cx = 150 + i * 400;
    ctx.strokeStyle = '#333340';
    ctx.lineWidth = 2;
    for (let j = 0; j < 5; j++) {
      ctx.beginPath();
      ctx.ellipse(cx, 100 + j * 20, 4, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
  // Fog effect at bottom
  ctx.fillStyle = 'rgba(20, 20, 40, 0.3)';
  ctx.fillRect(0, 450, 1200, 150);
}

function drawPillar(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Base
  ctx.fillStyle = '#2a2a35';
  ctx.fillRect(x - 12, y + 200, 24, 20);
  // Column
  ctx.fillStyle = '#333340';
  ctx.fillRect(x - 8, y, 16, 200);
  // Top
  ctx.fillStyle = '#2a2a35';
  ctx.fillRect(x - 12, y - 5, 24, 10);
  // Detail
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(x - 6, y + 20, 2, 160);
  ctx.fillRect(x + 4, y + 20, 2, 160);
}

function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  // Bracket
  ctx.fillStyle = '#444455';
  ctx.fillRect(x - 2, y, 4, 15);
  
  // Flame
  const flicker = Math.sin(time * 0.2) * 2;
  const flicker2 = Math.cos(time * 0.3) * 1.5;
  
  // Glow
  const glowGrad = ctx.createRadialGradient(x, y - 5, 0, x, y - 5, 30);
  glowGrad.addColorStop(0, 'rgba(255, 150, 50, 0.3)');
  glowGrad.addColorStop(1, 'rgba(255, 100, 20, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(x - 30, y - 35, 60, 60);
  
  // Flame body
  ctx.fillStyle = '#ff6622';
  ctx.fillRect(x - 3 + flicker2, y - 10, 6, 10);
  ctx.fillStyle = '#ffaa22';
  ctx.fillRect(x - 2 + flicker, y - 14, 4, 8);
  ctx.fillStyle = '#ffdd44';
  ctx.fillRect(x - 1, y - 12 + flicker, 2, 4);
}

function drawBonfire(ctx: CanvasRenderingContext2D, bonfire: Bonfire) {
  const { pos, animTimer } = bonfire;
  
  // Base stones
  ctx.fillStyle = '#444455';
  ctx.fillRect(pos.x - 12, pos.y + 10, 24, 8);
  ctx.fillStyle = '#333344';
  ctx.fillRect(pos.x - 8, pos.y + 5, 16, 10);
  
  // Sword
  ctx.fillStyle = '#666677';
  ctx.fillRect(pos.x - 1, pos.y - 25, 2, 30);
  ctx.fillStyle = '#555566';
  ctx.fillRect(pos.x - 5, pos.y - 5, 10, 2);
  
  if (bonfire.lit) {
    // Fire glow
    const glowGrad = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 60);
    glowGrad.addColorStop(0, 'rgba(255, 120, 30, 0.4)');
    glowGrad.addColorStop(0.5, 'rgba(255, 80, 20, 0.15)');
    glowGrad.addColorStop(1, 'rgba(255, 50, 10, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(pos.x - 60, pos.y - 60, 120, 120);
    
    // Fire
    const f1 = Math.sin(animTimer * 0.15) * 3;
    const f2 = Math.cos(animTimer * 0.2) * 2;
    
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(pos.x - 6 + f2, pos.y - 5, 12, 12);
    ctx.fillStyle = '#ff7700';
    ctx.fillRect(pos.x - 4 + f1, pos.y - 12, 8, 14);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(pos.x - 3, pos.y - 16 + f2, 6, 10);
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(pos.x - 2 + f1 * 0.5, pos.y - 20, 4, 8);
    
    // Embers
    for (let i = 0; i < 3; i++) {
      const ex = pos.x + Math.sin(animTimer * 0.1 + i * 2) * 10;
      const ey = pos.y - 20 - ((animTimer * 0.5 + i * 20) % 30);
      ctx.fillStyle = `rgba(255, ${150 + i * 30}, 0, ${1 - ((animTimer * 0.5 + i * 20) % 30) / 30})`;
      ctx.fillRect(ex, ey, 2, 2);
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: Entity, time: number) {
  if (player.state === 'dead') {
    ctx.globalAlpha = 0.5;
  }
  if (player.invincible && Math.floor(time * 0.5) % 2 === 0) {
    ctx.globalAlpha = 0.5;
  }
  
  const { pos, facing, state: pState } = player;
  const flip = facing === 'left' ? -1 : 1;
  
  ctx.save();
  ctx.translate(pos.x + player.width / 2, pos.y + player.height);
  ctx.scale(flip, 1);
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-10, -2, 20, 4);
  
  // Body animation
  let bodyOffset = 0;
  let armAngle = 0;
  
  if (pState === 'walking') {
    bodyOffset = Math.sin(time * 0.3) * 2;
  }
  if (pState === 'attacking') {
    armAngle = -Math.PI * 0.7 * (1 - player.stateTimer / 25);
  }
  if (pState === 'dodging') {
    bodyOffset = -3;
  }
  if (pState === 'hurt') {
    bodyOffset = 2;
  }
  
  // Legs
  const legOffset = pState === 'walking' ? Math.sin(time * 0.3) * 3 : 0;
  ctx.fillStyle = '#334455';
  ctx.fillRect(-5, -10 + bodyOffset, 4, 10);
  ctx.fillRect(1, -10 + bodyOffset - legOffset, 4, 10);
  
  // Boots
  ctx.fillStyle = '#222233';
  ctx.fillRect(-6, -2 + bodyOffset, 5, 3);
  ctx.fillRect(0, -2 + bodyOffset - legOffset, 5, 3);
  
  // Body/armor
  ctx.fillStyle = '#445566';
  ctx.fillRect(-7, -24 + bodyOffset, 14, 16);
  
  // Armor detail
  ctx.fillStyle = '#556677';
  ctx.fillRect(-5, -22 + bodyOffset, 10, 4);
  ctx.fillStyle = '#334455';
  ctx.fillRect(-3, -18 + bodyOffset, 6, 8);
  
  // Cape
  ctx.fillStyle = '#662233';
  const capeWave = Math.sin(time * 0.1) * 2;
  ctx.fillRect(-8, -22 + bodyOffset, 3, 14 + capeWave);
  
  // Head
  ctx.fillStyle = '#556677';
  ctx.fillRect(-5, -32 + bodyOffset, 10, 10);
  
  // Helmet visor
  ctx.fillStyle = '#222233';
  ctx.fillRect(-3, -28 + bodyOffset, 8, 4);
  
  // Helmet crest
  ctx.fillStyle = '#778899';
  ctx.fillRect(-2, -34 + bodyOffset, 4, 3);
  
  // Arms
  ctx.save();
  ctx.translate(5, -20 + bodyOffset);
  ctx.rotate(armAngle);
  
  // Arm
  ctx.fillStyle = '#445566';
  ctx.fillRect(0, 0, 4, 12);
  
  // Weapon (sword)
  if (pState === 'attacking') {
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(2, -20, 2, 22);
    ctx.fillStyle = '#887744';
    ctx.fillRect(0, 0, 6, 3);
    // Sword glow during attack
    ctx.fillStyle = 'rgba(200, 220, 255, 0.5)';
    ctx.fillRect(1, -18, 4, 18);
  } else if (pState === 'blocking') {
    // Shield
    ctx.fillStyle = '#667788';
    ctx.fillRect(-2, -2, 10, 14);
    ctx.fillStyle = '#556677';
    ctx.fillRect(0, 0, 6, 10);
    ctx.fillStyle = '#778899';
    ctx.fillRect(2, 2, 2, 6);
  } else {
    // Sword at rest
    ctx.fillStyle = '#8899aa';
    ctx.fillRect(2, 4, 2, 16);
    ctx.fillStyle = '#887744';
    ctx.fillRect(0, 2, 6, 3);
  }
  
  ctx.restore();
  
  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawEnemy(ctx: CanvasRenderingContext2D, enemy: Enemy, time: number) {
  if (enemy.invincible && Math.floor(time * 0.5) % 2 === 0) {
    ctx.globalAlpha = 0.6;
  }
  
  const { pos, facing, type, state: eState } = enemy;
  const flip = facing === 'left' ? -1 : 1;
  
  ctx.save();
  ctx.translate(pos.x + enemy.width / 2, pos.y + enemy.height);
  ctx.scale(flip, 1);
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  const shadowSize = type === 'boss' ? 20 : 10;
  ctx.fillRect(-shadowSize, -2, shadowSize * 2, 4);
  
  let bodyOffset = 0;
  let armAngle = 0;
  
  if (eState === 'walking') bodyOffset = Math.sin(time * 0.2) * 2;
  if (eState === 'attacking') armAngle = -Math.PI * 0.6 * (1 - enemy.stateTimer / 30);
  if (eState === 'hurt') bodyOffset = 3;
  
  if (type === 'hollow') {
    // Hollow soldier - undead creature
    // Legs
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-4, -8 + bodyOffset, 3, 8);
    ctx.fillRect(1, -8 + bodyOffset, 3, 8);
    
    // Body - ragged
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-6, -20 + bodyOffset, 12, 14);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-4, -18 + bodyOffset, 8, 10);
    
    // Head
    ctx.fillStyle = '#5a5a4a';
    ctx.fillRect(-4, -26 + bodyOffset, 8, 8);
    // Eyes (red glowing)
    ctx.fillStyle = '#ff3322';
    ctx.fillRect(-2, -24 + bodyOffset, 2, 2);
    ctx.fillRect(2, -24 + bodyOffset, 2, 2);
    
    // Weapon arm
    ctx.save();
    ctx.translate(4, -16 + bodyOffset);
    ctx.rotate(armAngle);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(0, 0, 3, 10);
    // Rusty sword
    ctx.fillStyle = '#665544';
    ctx.fillRect(1, -12, 2, 14);
    ctx.restore();
    
  } else if (type === 'knight') {
    // Dark knight
    // Legs
    ctx.fillStyle = '#2a2a35';
    ctx.fillRect(-5, -10 + bodyOffset, 4, 10);
    ctx.fillRect(1, -10 + bodyOffset, 4, 10);
    
    // Body - heavy armor
    ctx.fillStyle = '#3a3a45';
    ctx.fillRect(-8, -26 + bodyOffset, 16, 18);
    ctx.fillStyle = '#2a2a35';
    ctx.fillRect(-6, -24 + bodyOffset, 12, 14);
    
    // Shoulder pads
    ctx.fillStyle = '#4a4a55';
    ctx.fillRect(-10, -26 + bodyOffset, 4, 6);
    ctx.fillRect(6, -26 + bodyOffset, 4, 6);
    
    // Head - helmet
    ctx.fillStyle = '#3a3a45';
    ctx.fillRect(-5, -34 + bodyOffset, 10, 10);
    ctx.fillStyle = '#222230';
    ctx.fillRect(-3, -30 + bodyOffset, 8, 4);
    // Red eyes
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(-1, -29 + bodyOffset, 2, 2);
    ctx.fillRect(3, -29 + bodyOffset, 2, 2);
    
    // Weapon arm
    ctx.save();
    ctx.translate(6, -20 + bodyOffset);
    ctx.rotate(armAngle);
    ctx.fillStyle = '#3a3a45';
    ctx.fillRect(0, 0, 4, 12);
    // Great sword
    ctx.fillStyle = '#556677';
    ctx.fillRect(1, -22, 3, 24);
    ctx.fillStyle = '#443322';
    ctx.fillRect(-1, 0, 7, 3);
    ctx.restore();
    
  } else if (type === 'boss') {
    // BOSS - Fallen King
    const phase2 = enemy.phase === 2;
    const auraColor = phase2 ? 'rgba(255, 50, 50, 0.2)' : 'rgba(100, 50, 255, 0.15)';
    
    // Aura
    const auraGrad = ctx.createRadialGradient(0, -28, 0, 0, -28, 50);
    auraGrad.addColorStop(0, auraColor);
    auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = auraGrad;
    ctx.fillRect(-50, -78, 100, 100);
    
    // Legs
    ctx.fillStyle = phase2 ? '#3a1a1a' : '#2a1a2a';
    ctx.fillRect(-8, -14 + bodyOffset, 6, 14);
    ctx.fillRect(2, -14 + bodyOffset, 6, 14);
    
    // Body - massive armor
    ctx.fillStyle = phase2 ? '#4a2020' : '#2a2040';
    ctx.fillRect(-14, -40 + bodyOffset, 28, 28);
    ctx.fillStyle = phase2 ? '#3a1515' : '#1a1530';
    ctx.fillRect(-12, -38 + bodyOffset, 24, 24);
    
    // Chest emblem
    ctx.fillStyle = phase2 ? '#ff4444' : '#6644aa';
    ctx.fillRect(-4, -34 + bodyOffset, 8, 8);
    ctx.fillStyle = phase2 ? '#ffaa44' : '#8866cc';
    ctx.fillRect(-2, -32 + bodyOffset, 4, 4);
    
    // Shoulder armor
    ctx.fillStyle = phase2 ? '#5a2525' : '#3a2a50';
    ctx.fillRect(-18, -40 + bodyOffset, 6, 10);
    ctx.fillRect(12, -40 + bodyOffset, 6, 10);
    
    // Head - crown helmet
    ctx.fillStyle = phase2 ? '#4a2020' : '#2a2040';
    ctx.fillRect(-8, -52 + bodyOffset, 16, 14);
    ctx.fillStyle = phase2 ? '#331010' : '#15102a';
    ctx.fillRect(-6, -48 + bodyOffset, 12, 8);
    
    // Crown
    ctx.fillStyle = phase2 ? '#ff6600' : '#8855cc';
    ctx.fillRect(-6, -56 + bodyOffset, 3, 5);
    ctx.fillRect(-1, -58 + bodyOffset, 3, 7);
    ctx.fillRect(4, -56 + bodyOffset, 3, 5);
    
    // Eyes
    ctx.fillStyle = phase2 ? '#ff0000' : '#aa44ff';
    ctx.fillRect(-4, -46 + bodyOffset, 3, 3);
    ctx.fillRect(2, -46 + bodyOffset, 3, 3);
    
    // Weapon arm - massive sword
    ctx.save();
    ctx.translate(10, -32 + bodyOffset);
    ctx.rotate(armAngle);
    ctx.fillStyle = phase2 ? '#4a2020' : '#2a2040';
    ctx.fillRect(0, 0, 6, 16);
    // Ultra greatsword
    ctx.fillStyle = phase2 ? '#aa3333' : '#5544aa';
    ctx.fillRect(1, -35, 4, 38);
    ctx.fillStyle = phase2 ? '#ff4444' : '#7766cc';
    ctx.fillRect(2, -33, 2, 34);
    // Guard
    ctx.fillStyle = phase2 ? '#884400' : '#443388';
    ctx.fillRect(-3, 0, 12, 4);
    ctx.restore();
    
    // Cape
    ctx.fillStyle = phase2 ? '#440000' : '#220044';
    const capeWave = Math.sin(time * 0.08) * 3;
    ctx.fillRect(-16, -38 + bodyOffset, 4, 30 + capeWave);
  }
  
  ctx.restore();
  ctx.globalAlpha = 1;
  
  // HP bar for enemies
  if (enemy.hp < enemy.maxHp) {
    const barWidth = type === 'boss' ? 60 : 30;
    const barX = pos.x + enemy.width / 2 - barWidth / 2;
    const barY = pos.y - 10;
    
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, 4);
    ctx.fillStyle = type === 'boss' ? '#ff4444' : '#44aa44';
    ctx.fillRect(barX, barY, barWidth * (enemy.hp / enemy.maxHp), 4);
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, particle: Particle) {
  const alpha = particle.life / particle.maxLife;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = particle.color;
  ctx.fillRect(particle.pos.x - particle.size / 2, particle.pos.y - particle.size / 2, particle.size, particle.size);
  ctx.globalAlpha = 1;
}

function drawDamageNumber(ctx: CanvasRenderingContext2D, dmg: DamageNumber) {
  const alpha = dmg.life / 40;
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = dmg.color;
  ctx.textAlign = 'center';
  if (dmg.value === 0) {
    ctx.fillText('BLOCK', dmg.pos.x, dmg.pos.y);
  } else {
    ctx.fillText(dmg.value.toString(), dmg.pos.x, dmg.pos.y);
  }
  ctx.globalAlpha = 1;
}

function drawUI(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const player = state.player;
  
  // HP Bar
  const hpBarWidth = 200;
  const hpBarHeight = 16;
  const hpX = 20;
  const hpY = 20;
  
  // HP background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(hpX - 2, hpY - 2, hpBarWidth + 4, hpBarHeight + 4);
  ctx.fillStyle = '#333';
  ctx.fillRect(hpX, hpY, hpBarWidth, hpBarHeight);
  
  // HP fill
  const hpPercent = player.hp / player.maxHp;
  const hpColor = hpPercent > 0.5 ? '#44aa44' : hpPercent > 0.25 ? '#aaaa44' : '#aa4444';
  ctx.fillStyle = hpColor;
  ctx.fillRect(hpX, hpY, hpBarWidth * hpPercent, hpBarHeight);
  
  // HP text
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(player.hp)}/${player.maxHp}`, hpX + 5, hpY + 12);
  
  // Stamina Bar
  const stamY = hpY + hpBarHeight + 6;
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(hpX - 2, stamY - 2, hpBarWidth + 4, 10 + 4);
  ctx.fillStyle = '#333';
  ctx.fillRect(hpX, stamY, hpBarWidth, 10);
  
  const stamPercent = player.stamina / player.maxStamina;
  ctx.fillStyle = '#4488aa';
  ctx.fillRect(hpX, stamY, hpBarWidth * stamPercent, 10);
  
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(`STAMINA`, hpX + 5, stamY + 8);
  
  // Souls counter
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#ffdd44';
  ctx.textAlign = 'left';
  ctx.fillText(`⬡ ${state.souls}`, 20, stamY + 30);
  
  // Area indicator
  ctx.font = '12px monospace';
  ctx.fillStyle = '#888899';
  ctx.textAlign = 'right';
  ctx.fillText(`Area ${state.level}/3`, w - 20, 30);
  
  // Boss HP bar (if boss exists and is alive)
  const boss = state.enemies.find(e => e.type === 'boss' && e.state !== 'dead');
  if (boss) {
    const bossBarWidth = 400;
    const bossBarX = w / 2 - bossBarWidth / 2;
    const bossBarY = h - 50;
    
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bossBarX - 2, bossBarY - 2, bossBarWidth + 4, 20 + 4);
    ctx.fillStyle = '#222';
    ctx.fillRect(bossBarX, bossBarY, bossBarWidth, 20);
    
    const bossHpPercent = boss.hp / boss.maxHp;
    ctx.fillStyle = boss.phase === 2 ? '#ff2222' : '#aa2244';
    ctx.fillRect(bossBarX, bossBarY, bossBarWidth * bossHpPercent, 20);
    
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('FALLEN KING', w / 2, bossBarY + 14);
  }
  
  // Controls hint
  ctx.font = '10px monospace';
  ctx.fillStyle = '#555566';
  ctx.textAlign = 'right';
  ctx.fillText('WASD:Move  SPACE:Attack  SHIFT:Dodge  RClick:Block  E:Rest', w - 10, h - 10);
}

function drawMessage(ctx: CanvasRenderingContext2D, message: string, w: number, h: number) {
  ctx.font = 'bold 24px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(message, w / 2, h / 2 - 50);
}

function drawDeathScreen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(10, 0, 0, 0.7)';
  ctx.fillRect(0, 0, w, h);
  
  ctx.font = 'bold 48px monospace';
  ctx.fillStyle = '#8b0000';
  ctx.textAlign = 'center';
  ctx.fillText('YOU DIED', w / 2, h / 2);
  
  ctx.font = '16px monospace';
  ctx.fillStyle = '#666';
  ctx.fillText('Press R to respawn', w / 2, h / 2 + 40);
}

function drawVictoryScreen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 0, 10, 0.7)';
  ctx.fillRect(0, 0, w, h);
  
  ctx.font = 'bold 36px monospace';
  ctx.fillStyle = '#ffdd44';
  ctx.textAlign = 'center';
  ctx.fillText('VICTORY ACHIEVED', w / 2, h / 2 - 30);
  
  ctx.font = '16px monospace';
  ctx.fillStyle = '#aaaacc';
  ctx.fillText('The Fallen King has been vanquished', w / 2, h / 2 + 10);
  ctx.fillText('Press R to play again', w / 2, h / 2 + 40);
}
