import { GameState, Enemy, Bonfire, Particle, DamageNumber } from './types';

const TILE_SIZE = 16;
const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 600;

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
  
  // Calculate scale to fit world in canvas
  const scaleX = canvasWidth / 800;
  const scaleY = canvasHeight / 500;
  const scale = Math.min(scaleX, scaleY);
  
  // Center the game view
  const offsetX = (canvasWidth - 800 * scale) / 2;
  const offsetY = (canvasHeight - 500 * scale) / 2;
  
  ctx.save();
  ctx.translate(offsetX, offsetY);
  ctx.scale(scale, scale);
  
  // Camera transform
  ctx.save();
  ctx.translate(-state.camera.x, -state.camera.y);
  
  drawBackground(ctx, state);
  drawBonfire(ctx, state.bonfire);
  
  // Sort entities by Y for proper depth
  const entities: { y: number; draw: () => void }[] = [];
  
  state.enemies.forEach(enemy => {
    if (enemy.state !== 'dead') {
      entities.push({ y: enemy.pos.y + enemy.height, draw: () => drawEnemy(ctx, enemy, state.gameTime) });
    }
  });
  entities.push({ y: state.player.pos.y + state.player.height, draw: () => drawPlayer(ctx, state.player, state.gameTime) });
  
  entities.sort((a, b) => a.y - b.y);
  entities.forEach(e => e.draw());
  
  state.particles.forEach(p => drawParticle(ctx, p));
  state.damageNumbers.forEach(d => drawDamageNumber(ctx, d));
  
  ctx.restore(); // camera
  ctx.restore(); // scale
  
  // Draw UI at screen space (not affected by camera/scale)
  drawUI(ctx, state, canvasWidth, canvasHeight);
  
  if (state.messageTimer > 0) {
    drawMessage(ctx, state.message, canvasWidth, canvasHeight);
  }
  
  if (state.phase === 'dead') {
    drawDeathScreen(ctx, canvasWidth, canvasHeight);
  }
  
  if (state.phase === 'victory') {
    drawVictoryScreen(ctx, canvasWidth, canvasHeight);
  }
  
  ctx.restore(); // shake
}

function drawBackground(ctx: CanvasRenderingContext2D, state: GameState) {
  const startX = Math.floor(state.camera.x / TILE_SIZE) * TILE_SIZE;
  const startY = Math.floor(state.camera.y / TILE_SIZE) * TILE_SIZE;
  const endX = startX + 850;
  const endY = startY + 550;
  
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  grad.addColorStop(0, '#0a0a15');
  grad.addColorStop(0.5, '#12121f');
  grad.addColorStop(1, '#1a1a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  
  // Stone tiles on floor
  for (let x = startX; x < endX; x += TILE_SIZE) {
    for (let y = startY; y < endY; y += TILE_SIZE) {
      if (y > 420) {
        const shade = ((x + y) % 32 === 0) ? '#2a2a35' : '#222230';
        ctx.fillStyle = shade;
        ctx.fillRect(x, y, TILE_SIZE - 1, TILE_SIZE - 1);
        
        if ((x * 7 + y * 13) % 64 === 0) {
          ctx.fillStyle = '#1a1a25';
          ctx.fillRect(x + 4, y + 4, 4, 4);
        }
      } else if (y > 380) {
        ctx.fillStyle = '#181825';
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
      }
    }
  }
  
  // Walls
  drawPillar(ctx, 200, 180);
  drawPillar(ctx, 600, 160);
  drawPillar(ctx, 1000, 190);
  
  // Torches
  drawTorch(ctx, 300, 230, state.gameTime);
  drawTorch(ctx, 700, 210, state.gameTime);
  drawTorch(ctx, 1100, 230, state.gameTime);
  
  // Chains
  for (let i = 0; i < 3; i++) {
    const cx = 150 + i * 400;
    ctx.strokeStyle = '#333340';
    ctx.lineWidth = 2;
    for (let j = 0; j < 4; j++) {
      ctx.beginPath();
      ctx.ellipse(cx, 120 + j * 18, 3, 7, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  
  // Fog
  ctx.fillStyle = 'rgba(20, 20, 40, 0.2)';
  ctx.fillRect(0, 460, WORLD_WIDTH, 140);
  
  // World border indicators
  ctx.fillStyle = '#15151f';
  ctx.fillRect(0, 0, 15, WORLD_HEIGHT);
  ctx.fillRect(WORLD_WIDTH - 15, 0, 15, WORLD_HEIGHT);
}

function drawPillar(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#2a2a35';
  ctx.fillRect(x - 12, y + 220, 24, 16);
  ctx.fillStyle = '#333340';
  ctx.fillRect(x - 8, y, 16, 220);
  ctx.fillStyle = '#2a2a35';
  ctx.fillRect(x - 12, y - 4, 24, 8);
  ctx.fillStyle = '#3a3a48';
  ctx.fillRect(x - 5, y + 20, 2, 180);
  ctx.fillRect(x + 3, y + 20, 2, 180);
}

function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, time: number) {
  ctx.fillStyle = '#444455';
  ctx.fillRect(x - 2, y, 4, 12);
  
  const flicker = Math.sin(time * 0.2) * 2;
  const flicker2 = Math.cos(time * 0.3) * 1.5;
  
  const glowGrad = ctx.createRadialGradient(x, y - 4, 0, x, y - 4, 35);
  glowGrad.addColorStop(0, 'rgba(255, 150, 50, 0.25)');
  glowGrad.addColorStop(1, 'rgba(255, 100, 20, 0)');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(x - 35, y - 39, 70, 70);
  
  ctx.fillStyle = '#ff6622';
  ctx.fillRect(x - 3 + flicker2, y - 8, 6, 8);
  ctx.fillStyle = '#ffaa22';
  ctx.fillRect(x - 2 + flicker, y - 12, 4, 7);
  ctx.fillStyle = '#ffdd44';
  ctx.fillRect(x - 1, y - 10 + flicker, 2, 4);
}

function drawBonfire(ctx: CanvasRenderingContext2D, bonfire: Bonfire) {
  const { pos, animTimer } = bonfire;
  
  ctx.fillStyle = '#444455';
  ctx.fillRect(pos.x - 14, pos.y + 8, 28, 8);
  ctx.fillStyle = '#333344';
  ctx.fillRect(pos.x - 10, pos.y + 2, 20, 10);
  
  // Sword
  ctx.fillStyle = '#666677';
  ctx.fillRect(pos.x - 1, pos.y - 28, 2, 32);
  ctx.fillStyle = '#555566';
  ctx.fillRect(pos.x - 5, pos.y - 6, 10, 2);
  
  if (bonfire.lit) {
    const glowGrad = ctx.createRadialGradient(pos.x, pos.y - 5, 0, pos.x, pos.y - 5, 70);
    glowGrad.addColorStop(0, 'rgba(255, 120, 30, 0.35)');
    glowGrad.addColorStop(0.5, 'rgba(255, 80, 20, 0.12)');
    glowGrad.addColorStop(1, 'rgba(255, 50, 10, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(pos.x - 70, pos.y - 75, 140, 140);
    
    const f1 = Math.sin(animTimer * 0.15) * 3;
    const f2 = Math.cos(animTimer * 0.2) * 2;
    
    ctx.fillStyle = '#ff4400';
    ctx.fillRect(pos.x - 7 + f2, pos.y - 6, 14, 12);
    ctx.fillStyle = '#ff7700';
    ctx.fillRect(pos.x - 5 + f1, pos.y - 14, 10, 14);
    ctx.fillStyle = '#ffaa00';
    ctx.fillRect(pos.x - 3, pos.y - 18 + f2, 6, 10);
    ctx.fillStyle = '#ffdd44';
    ctx.fillRect(pos.x - 2 + f1 * 0.5, pos.y - 22, 4, 8);
    
    for (let i = 0; i < 3; i++) {
      const ex = pos.x + Math.sin(animTimer * 0.1 + i * 2) * 12;
      const ey = pos.y - 22 - ((animTimer * 0.5 + i * 20) % 35);
      const alpha = 1 - ((animTimer * 0.5 + i * 20) % 35) / 35;
      ctx.fillStyle = `rgba(255, ${150 + i * 30}, 0, ${alpha})`;
      ctx.fillRect(ex, ey, 2, 2);
    }
  }
}

function drawPlayer(ctx: CanvasRenderingContext2D, player: { pos: { x: number; y: number }; width: number; height: number; facing: string; state: string; stateTimer: number; invincible: boolean; maxHp: number; hp: number }, time: number) {
  if (player.state === 'dead') ctx.globalAlpha = 0.4;
  if (player.invincible && Math.floor(time * 0.5) % 2 === 0) ctx.globalAlpha = 0.5;
  
  const { pos, facing, state: pState } = player;
  const flip = facing === 'left' ? -1 : 1;
  
  ctx.save();
  ctx.translate(pos.x + player.width / 2, pos.y + player.height);
  ctx.scale(flip, 1);
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 10, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  let bodyOffset = 0;
  let armAngle = 0;
  
  if (pState === 'walking') bodyOffset = Math.sin(time * 0.3) * 2;
  if (pState === 'attacking') armAngle = -Math.PI * 0.7 * (1 - player.stateTimer / 22);
  if (pState === 'dodging') bodyOffset = -4;
  if (pState === 'hurt') bodyOffset = 3;
  
  const legOffset = pState === 'walking' ? Math.sin(time * 0.3) * 3 : 0;
  
  // Legs
  ctx.fillStyle = '#334455';
  ctx.fillRect(-5, -10 + bodyOffset, 4, 10);
  ctx.fillRect(1, -10 + bodyOffset - legOffset, 4, 10);
  
  // Boots
  ctx.fillStyle = '#222233';
  ctx.fillRect(-6, -2 + bodyOffset, 5, 3);
  ctx.fillRect(0, -2 + bodyOffset - legOffset, 5, 3);
  
  // Body
  ctx.fillStyle = '#445566';
  ctx.fillRect(-7, -24 + bodyOffset, 14, 16);
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
  ctx.fillStyle = '#222233';
  ctx.fillRect(-3, -28 + bodyOffset, 8, 4);
  ctx.fillStyle = '#778899';
  ctx.fillRect(-2, -34 + bodyOffset, 4, 3);
  
  // Arms + Weapon
  ctx.save();
  ctx.translate(5, -20 + bodyOffset);
  ctx.rotate(armAngle);
  
  ctx.fillStyle = '#445566';
  ctx.fillRect(0, 0, 4, 12);
  
  if (pState === 'attacking') {
    ctx.fillStyle = '#aabbcc';
    ctx.fillRect(2, -22, 2, 24);
    ctx.fillStyle = '#887744';
    ctx.fillRect(0, 0, 6, 3);
    ctx.fillStyle = 'rgba(200, 220, 255, 0.4)';
    ctx.fillRect(1, -20, 4, 20);
  } else if (pState === 'blocking') {
    // Shield
    ctx.fillStyle = '#667788';
    ctx.fillRect(-4, -4, 12, 16);
    ctx.fillStyle = '#556677';
    ctx.fillRect(-2, -2, 8, 12);
    ctx.fillStyle = '#778899';
    ctx.fillRect(1, 1, 3, 7);
    // Shield emblem
    ctx.fillStyle = '#8b6914';
    ctx.fillRect(1, 3, 3, 3);
  } else {
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
  if (enemy.invincible && Math.floor(time * 0.5) % 2 === 0) ctx.globalAlpha = 0.6;
  
  const { pos, facing, type, state: eState } = enemy;
  const flip = facing === 'left' ? -1 : 1;
  
  ctx.save();
  ctx.translate(pos.x + enemy.width / 2, pos.y + enemy.height);
  ctx.scale(flip, 1);
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  const shadowSize = type === 'boss' ? 22 : type === 'knight' ? 12 : 8;
  ctx.beginPath();
  ctx.ellipse(0, 0, shadowSize, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  
  let bodyOffset = 0;
  let armAngle = 0;
  
  if (eState === 'walking') bodyOffset = Math.sin(time * 0.2) * 2;
  if (eState === 'attacking') armAngle = -Math.PI * 0.6 * (1 - enemy.stateTimer / 30);
  if (eState === 'hurt') bodyOffset = 3;
  
  if (type === 'hollow') {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(-4, -8 + bodyOffset, 3, 8);
    ctx.fillRect(1, -8 + bodyOffset, 3, 8);
    
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(-6, -20 + bodyOffset, 12, 14);
    ctx.fillStyle = '#3a2a1a';
    ctx.fillRect(-4, -18 + bodyOffset, 8, 10);
    
    ctx.fillStyle = '#5a5a4a';
    ctx.fillRect(-4, -26 + bodyOffset, 8, 8);
    ctx.fillStyle = '#ff3322';
    ctx.fillRect(-2, -24 + bodyOffset, 2, 2);
    ctx.fillRect(2, -24 + bodyOffset, 2, 2);
    
    ctx.save();
    ctx.translate(4, -16 + bodyOffset);
    ctx.rotate(armAngle);
    ctx.fillStyle = '#4a3a2a';
    ctx.fillRect(0, 0, 3, 10);
    ctx.fillStyle = '#665544';
    ctx.fillRect(1, -12, 2, 14);
    ctx.restore();
    
  } else if (type === 'knight') {
    ctx.fillStyle = '#2a2a35';
    ctx.fillRect(-5, -10 + bodyOffset, 4, 10);
    ctx.fillRect(1, -10 + bodyOffset, 4, 10);
    
    ctx.fillStyle = '#3a3a45';
    ctx.fillRect(-8, -26 + bodyOffset, 16, 18);
    ctx.fillStyle = '#2a2a35';
    ctx.fillRect(-6, -24 + bodyOffset, 12, 14);
    
    ctx.fillStyle = '#4a4a55';
    ctx.fillRect(-10, -26 + bodyOffset, 4, 6);
    ctx.fillRect(6, -26 + bodyOffset, 4, 6);
    
    ctx.fillStyle = '#3a3a45';
    ctx.fillRect(-5, -34 + bodyOffset, 10, 10);
    ctx.fillStyle = '#222230';
    ctx.fillRect(-3, -30 + bodyOffset, 8, 4);
    ctx.fillStyle = '#ff2200';
    ctx.fillRect(-1, -29 + bodyOffset, 2, 2);
    ctx.fillRect(3, -29 + bodyOffset, 2, 2);
    
    ctx.save();
    ctx.translate(6, -20 + bodyOffset);
    ctx.rotate(armAngle);
    ctx.fillStyle = '#3a3a45';
    ctx.fillRect(0, 0, 4, 12);
    ctx.fillStyle = '#556677';
    ctx.fillRect(1, -22, 3, 24);
    ctx.fillStyle = '#443322';
    ctx.fillRect(-1, 0, 7, 3);
    ctx.restore();
    
  } else if (type === 'boss') {
    const phase2 = enemy.phase === 2;
    const auraColor = phase2 ? 'rgba(255, 50, 50, 0.2)' : 'rgba(100, 50, 255, 0.15)';
    
    const auraGrad = ctx.createRadialGradient(0, -28, 0, 0, -28, 55);
    auraGrad.addColorStop(0, auraColor);
    auraGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = auraGrad;
    ctx.fillRect(-55, -83, 110, 110);
    
    ctx.fillStyle = phase2 ? '#3a1a1a' : '#2a1a2a';
    ctx.fillRect(-8, -14 + bodyOffset, 6, 14);
    ctx.fillRect(2, -14 + bodyOffset, 6, 14);
    
    ctx.fillStyle = phase2 ? '#4a2020' : '#2a2040';
    ctx.fillRect(-14, -40 + bodyOffset, 28, 28);
    ctx.fillStyle = phase2 ? '#3a1515' : '#1a1530';
    ctx.fillRect(-12, -38 + bodyOffset, 24, 24);
    
    ctx.fillStyle = phase2 ? '#ff4444' : '#6644aa';
    ctx.fillRect(-4, -34 + bodyOffset, 8, 8);
    ctx.fillStyle = phase2 ? '#ffaa44' : '#8866cc';
    ctx.fillRect(-2, -32 + bodyOffset, 4, 4);
    
    ctx.fillStyle = phase2 ? '#5a2525' : '#3a2a50';
    ctx.fillRect(-18, -40 + bodyOffset, 6, 10);
    ctx.fillRect(12, -40 + bodyOffset, 6, 10);
    
    ctx.fillStyle = phase2 ? '#4a2020' : '#2a2040';
    ctx.fillRect(-8, -52 + bodyOffset, 16, 14);
    ctx.fillStyle = phase2 ? '#331010' : '#15102a';
    ctx.fillRect(-6, -48 + bodyOffset, 12, 8);
    
    ctx.fillStyle = phase2 ? '#ff6600' : '#8855cc';
    ctx.fillRect(-6, -56 + bodyOffset, 3, 5);
    ctx.fillRect(-1, -58 + bodyOffset, 3, 7);
    ctx.fillRect(4, -56 + bodyOffset, 3, 5);
    
    ctx.fillStyle = phase2 ? '#ff0000' : '#aa44ff';
    ctx.fillRect(-4, -46 + bodyOffset, 3, 3);
    ctx.fillRect(2, -46 + bodyOffset, 3, 3);
    
    ctx.save();
    ctx.translate(10, -32 + bodyOffset);
    ctx.rotate(armAngle);
    ctx.fillStyle = phase2 ? '#4a2020' : '#2a2040';
    ctx.fillRect(0, 0, 6, 16);
    ctx.fillStyle = phase2 ? '#aa3333' : '#5544aa';
    ctx.fillRect(1, -35, 4, 38);
    ctx.fillStyle = phase2 ? '#ff4444' : '#7766cc';
    ctx.fillRect(2, -33, 2, 34);
    ctx.fillStyle = phase2 ? '#884400' : '#443388';
    ctx.fillRect(-3, 0, 12, 4);
    ctx.restore();
    
    ctx.fillStyle = phase2 ? '#440000' : '#220044';
    const capeWave = Math.sin(time * 0.08) * 3;
    ctx.fillRect(-16, -38 + bodyOffset, 4, 30 + capeWave);
  }
  
  ctx.restore();
  ctx.globalAlpha = 1;
  
  // HP bar
  if (enemy.hp < enemy.maxHp && enemy.hp > 0) {
    const barWidth = type === 'boss' ? 60 : 30;
    const barX = pos.x + enemy.width / 2 - barWidth / 2;
    const barY = pos.y - 12;
    
    ctx.fillStyle = '#111';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, 6);
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
  ctx.fillRect(
    particle.pos.x - particle.size / 2, 
    particle.pos.y - particle.size / 2, 
    particle.size, 
    particle.size
  );
  ctx.globalAlpha = 1;
}

function drawDamageNumber(ctx: CanvasRenderingContext2D, dmg: DamageNumber) {
  const alpha = dmg.life / 45;
  ctx.globalAlpha = alpha;
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = dmg.color;
  ctx.textAlign = 'center';
  if (dmg.value === 0) {
    ctx.fillStyle = '#88aaff';
    ctx.fillText('BLOCKED', dmg.pos.x, dmg.pos.y);
  } else {
    ctx.fillText(dmg.value.toString(), dmg.pos.x, dmg.pos.y);
  }
  ctx.globalAlpha = 1;
}

function drawUI(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number) {
  const player = state.player;
  
  // HP Bar
  const hpBarWidth = Math.min(220, w * 0.25);
  const hpBarHeight = 18;
  const hpX = 20;
  const hpY = 20;
  
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(hpX - 2, hpY - 2, hpBarWidth + 4, hpBarHeight + 4);
  ctx.fillStyle = '#222';
  ctx.fillRect(hpX, hpY, hpBarWidth, hpBarHeight);
  
  const hpPercent = Math.max(0, player.hp / player.maxHp);
  const hpColor = hpPercent > 0.5 ? '#44aa44' : hpPercent > 0.25 ? '#aaaa44' : '#aa4444';
  ctx.fillStyle = hpColor;
  ctx.fillRect(hpX, hpY, hpBarWidth * hpPercent, hpBarHeight);
  
  // HP border highlight
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(hpX, hpY, hpBarWidth, hpBarHeight);
  
  ctx.font = 'bold 11px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.max(0, Math.ceil(player.hp))}/${player.maxHp}`, hpX + 5, hpY + 13);
  
  // Stamina Bar
  const stamY = hpY + hpBarHeight + 6;
  const stamH = 10;
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(hpX - 2, stamY - 2, hpBarWidth + 4, stamH + 4);
  ctx.fillStyle = '#222';
  ctx.fillRect(hpX, stamY, hpBarWidth, stamH);
  
  const stamPercent = player.stamina / player.maxStamina;
  ctx.fillStyle = stamPercent > 0.3 ? '#4488aa' : '#886644';
  ctx.fillRect(hpX, stamY, hpBarWidth * stamPercent, stamH);
  
  ctx.strokeStyle = '#333';
  ctx.strokeRect(hpX, stamY, hpBarWidth, stamH);
  
  ctx.font = 'bold 9px monospace';
  ctx.fillStyle = '#ccc';
  ctx.fillText('STAMINA', hpX + 4, stamY + 8);
  
  // Souls
  ctx.font = 'bold 14px monospace';
  ctx.fillStyle = '#ffdd44';
  ctx.textAlign = 'left';
  ctx.fillText(`⬡ ${state.souls}`, 20, stamY + 30);
  
  // Area
  ctx.font = '12px monospace';
  ctx.fillStyle = '#888899';
  ctx.textAlign = 'right';
  ctx.fillText(`Area ${state.level}/3`, w - 20, 30);
  
  // Boss HP bar
  const boss = state.enemies.find(e => e.type === 'boss' && e.state !== 'dead');
  if (boss) {
    const bossBarWidth = Math.min(400, w * 0.5);
    const bossBarX = w / 2 - bossBarWidth / 2;
    const bossBarY = h - 50;
    
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(bossBarX - 2, bossBarY - 2, bossBarWidth + 4, 22);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(bossBarX, bossBarY, bossBarWidth, 18);
    
    const bossHpPercent = boss.hp / boss.maxHp;
    const bossColor = boss.phase === 2 ? '#ff2222' : '#aa2244';
    ctx.fillStyle = bossColor;
    ctx.fillRect(bossBarX, bossBarY, bossBarWidth * bossHpPercent, 18);
    
    ctx.strokeStyle = '#444';
    ctx.strokeRect(bossBarX, bossBarY, bossBarWidth, 18);
    
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(boss.phase === 2 ? 'FALLEN KING — ENRAGED' : 'FALLEN KING', w / 2, bossBarY + 13);
  }
  
  // Controls hint
  ctx.font = '10px monospace';
  ctx.fillStyle = '#444455';
  ctx.textAlign = 'right';
  ctx.fillText('WASD:Move  SPACE:Attack  SHIFT:Dodge  RClick:Block  E:Rest', w - 10, h - 10);
}

function drawMessage(ctx: CanvasRenderingContext2D, message: string, w: number, h: number) {
  ctx.font = 'bold 28px monospace';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#000';
  ctx.shadowBlur = 8;
  ctx.fillText(message, w / 2, h / 2 - 60);
  ctx.shadowBlur = 0;
}

function drawDeathScreen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(10, 0, 0, 0.75)';
  ctx.fillRect(0, 0, w, h);
  
  ctx.font = 'bold 56px monospace';
  ctx.fillStyle = '#8b0000';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 20;
  ctx.fillText('YOU DIED', w / 2, h / 2);
  ctx.shadowBlur = 0;
  
  ctx.font = '16px monospace';
  ctx.fillStyle = '#666';
  ctx.fillText('Press R to rise again', w / 2, h / 2 + 45);
}

function drawVictoryScreen(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = 'rgba(0, 0, 10, 0.75)';
  ctx.fillRect(0, 0, w, h);
  
  ctx.font = 'bold 40px monospace';
  ctx.fillStyle = '#ffdd44';
  ctx.textAlign = 'center';
  ctx.shadowColor = '#ffaa00';
  ctx.shadowBlur = 15;
  ctx.fillText('VICTORY ACHIEVED', w / 2, h / 2 - 30);
  ctx.shadowBlur = 0;
  
  ctx.font = '16px monospace';
  ctx.fillStyle = '#aaaacc';
  ctx.fillText('The Fallen King has been vanquished', w / 2, h / 2 + 10);
  ctx.fillText('Press R for a new journey', w / 2, h / 2 + 40);
}
