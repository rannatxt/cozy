// ═══════════════════════════════════════════
// Espresso Escape — Clean Warm White Canvas Edition
// ═══════════════════════════════════════════

const COLORS = {
  bgDeep: '#FCFAF7',   // Cozy Warm White Background
  bgDark: '#F4EFE6',    // Light Latte Cream
  slateDark: '#1E1A17', // Dark Charcoal/Espresso Trim
  slateGray: '#4A433E',
  
  // Upgraded Aesthetic Matcha Colors
  matchaLiquid: '#66825B', 
  matchaLight: '#8CA37A',  
  matchaDeep: '#495E40',   
  
  // Obstacle & Game Details
  beanGold: '#E6A747',
  croissantGold: '#E4A054',
  croissantShadow: '#C67A26',
  mugBody: '#1E1A17',
  smoke: 'rgba(140, 98, 57, 0.12)', // Cozy steam
  chalkLine: 'rgba(140, 98, 57, 0.06)',
  
  // Skins
  classicBody: '#FFFFFF',
  matchaBody: '#D5E2CD',
  strawberryBody: '#FAD2E1',
};

const PLAYER_RADIUS = 16;
const GRAVITY = 0.58;
const FLIP_FORCE = 9.5; // Fixed physics bug direction
const BASE_SPEED = 3.6;
const SPEED_INCREMENT = 0.0006;
const OBSTACLE_SPAWN_DIST_MIN = 300;
const OBSTACLE_SPAWN_DIST_MAX = 450;
const GROUND_HEIGHT = 60;
const BEAN_RADIUS = 9;
const SUGAR_SIZE = 16;
const COIN_SPAWN_CHANCE = 0.45;

export default class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.running = false;
    this.started = false;
    this.score = 0;
    this.bestScore = parseInt(localStorage.getItem('ag_best') || '0');
    this.speed = BASE_SPEED;
    this.gravityDir = 1; // 1 = normal (falling to floor), -1 = inverted (ceiling)
    
    // Skins
    this.activeSkin = 'classic';

    // Player
    this.player = {
      x: 0,
      y: 0,
      vy: 0,
      radius: PLAYER_RADIUS,
      rotation: 0,
      targetRotation: 0,
      eyeState: 'happy',
      eyeTimer: 0,
    };

    // Power-up
    this.sugarRushActive = false;
    this.sugarRushDuration = 300;
    this.sugarRushTimer = 0;

    this.obstacles = [];
    this.beans = [];
    this.sugars = [];
    this.particles = [];
    this.coffeeSplashes = [];
    this.bgChalkDecor = [];
    
    this.distSinceLastObstacle = 0;
    this.nextObstacleAt = 350;
    this.frameId = null;
    this.lastTime = 0;
    this.scoreTimer = 0;
    
    this.onScoreUpdate = null;
    this.onGameOver = null;
    this.onPowerupChange = null;
    
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.flashAlpha = 0;

    this._resize();
    this._initBgDecor();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.floorY = this.height - GROUND_HEIGHT;
    this.ceilY = GROUND_HEIGHT;
  }

  _initBgDecor() {
    this.bgChalkDecor = [];
    const decorTypes = ['cup', 'bean', 'star', 'steam'];
    for (let i = 0; i < 15; i++) {
      this.bgChalkDecor.push({
        x: Math.random() * 2000,
        y: this.ceilY + Math.random() * (this.floorY - this.ceilY - 100),
        type: decorTypes[Math.floor(Math.random() * decorTypes.length)],
        size: Math.random() * 25 + 15,
        speed: Math.random() * 0.4 + 0.1,
        rotation: Math.random() * Math.PI,
        rotSpeed: (Math.random() - 0.5) * 0.005,
      });
    }
  }

  setSkin(skinName) {
    this.activeSkin = skinName;
  }

  reset() {
    this.score = 0;
    this.speed = BASE_SPEED;
    this.gravityDir = 1;
    this.obstacles = [];
    this.beans = [];
    this.sugars = [];
    this.particles = [];
    this.coffeeSplashes = [];
    this.distSinceLastObstacle = 0;
    this.nextObstacleAt = 300;
    this.scoreTimer = 0;
    this.shakeTimer = 0;
    this.flashAlpha = 0;

    this.sugarRushActive = false;
    this.sugarRushTimer = 0;
    if (this.onPowerupChange) this.onPowerupChange(false, 0);

    this.player.x = this.width * 0.22;
    this.player.y = this.height * 0.5;
    this.player.vy = 0;
    this.player.rotation = 0;
    this.player.targetRotation = 0;
    this.player.eyeState = 'happy';
    this.player.eyeTimer = 0;

    this.started = false;
    this.running = false;
  }

  start() {
    this.reset();
    this.running = true;
    this.started = false;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  beginPlay() {
    this.started = true;
    this.player.eyeState = 'happy';
  }

  flipGravity() {
    if (!this.running) return;
    if (!this.started) {
      this.beginPlay();
    }
    
    // Invert gravity direction
    this.gravityDir *= -1;
    
    // Physics bug fix: apply impulse in the same direction as the new gravity!
    this.player.vy = FLIP_FORCE * this.gravityDir;
    
    this.player.targetRotation = this.gravityDir === 1 ? 0 : Math.PI;
    this.player.eyeState = 'surprised';
    this.player.eyeTimer = 15;

    // Splashes
    const splashY = this.player.y - this.gravityDir * 8;
    for (let i = 0; i < 7; i++) {
      this.coffeeSplashes.push({
        x: this.player.x,
        y: splashY,
        vx: (Math.random() - 0.5) * 6 - this.speed * 0.2,
        vy: -this.gravityDir * (Math.random() * 4 + 2),
        r: Math.random() * 3 + 2,
        color: COLORS.matchaLiquid,
        life: 1,
        decay: 0.03 + Math.random() * 0.02,
      });
    }

    // Steam
    for (let i = 0; i < 4; i++) {
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        life: 1,
        decay: 0.04,
        r: Math.random() * 6 + 4,
        color: COLORS.smoke,
      });
    }
  }

  stop() {
    this.running = false;
    if (this.frameId) cancelAnimationFrame(this.frameId);
  }

  _loop(timestamp) {
    if (!this.running) return;
    const dt = Math.min((timestamp - this.lastTime) / 16.667, 3);
    this.lastTime = timestamp;

    this._update(dt);
    this._draw();

    this.frameId = requestAnimationFrame((t) => this._loop(t));
  }

  _update(dt) {
    if (!this.started) return;

    const speedMult = this.sugarRushActive ? 1.4 : 1.0;
    this.speed = (BASE_SPEED + this.score * SPEED_INCREMENT) * speedMult;
    const moveX = this.speed * dt;

    this.scoreTimer += dt;
    if (this.scoreTimer >= 12) {
      this.score += this.sugarRushActive ? 2 : 1;
      this.scoreTimer = 0;
      if (this.onScoreUpdate) this.onScoreUpdate(this.score);
    }

    if (this.sugarRushActive) {
      this.sugarRushTimer -= dt;
      if (this.onPowerupChange) {
        this.onPowerupChange(true, Math.max(0, this.sugarRushTimer / this.sugarRushDuration));
      }
      if (this.sugarRushTimer <= 0) {
        this.sugarRushActive = false;
        if (this.onPowerupChange) this.onPowerupChange(false, 0);
      }
    }

    this.player.vy += GRAVITY * this.gravityDir * dt;
    this.player.y += this.player.vy * dt;

    const rotDiff = this.player.targetRotation - this.player.rotation;
    this.player.rotation += rotDiff * 0.25 * dt;

    const topBound = this.ceilY + this.player.radius;
    const botBound = this.floorY - this.player.radius;

    if (this.player.y < topBound) {
      this.player.y = topBound;
      this.player.vy = 0;
    }
    if (this.player.y > botBound) {
      this.player.y = botBound;
      this.player.vy = 0;
    }

    if (this.player.eyeTimer > 0) {
      this.player.eyeTimer -= dt;
      if (this.player.eyeTimer <= 0) {
        this.player.eyeState = 'happy';
      }
    }

    // Steam/sugar trail
    if (Math.random() < (this.sugarRushActive ? 0.60 : 0.25)) {
      const steamY = this.player.y - this.gravityDir * 12;
      this.particles.push({
        x: this.player.x - 6,
        y: steamY,
        vx: -this.speed * 0.4,
        vy: -this.gravityDir * (Math.random() * 1.5 + 0.5),
        r: this.sugarRushActive ? Math.random() * 4 + 2.5 : Math.random() * 3 + 2,
        life: 0.8,
        decay: this.sugarRushActive ? 0.025 : 0.03,
        color: this.sugarRushActive ? '#8CA37A' : COLORS.smoke,
      });
    }

    // Scroll Background chalk drawings
    for (const decor of this.bgChalkDecor) {
      decor.x -= decor.speed * dt;
      decor.rotation += decor.rotSpeed * dt;
      if (decor.x < -100) {
        decor.x = this.width + 100;
        decor.y = this.ceilY + Math.random() * (this.floorY - this.ceilY - 100);
      }
    }

    // Spawn obstacles, beans, sugar cubes
    this.distSinceLastObstacle += moveX;
    if (this.distSinceLastObstacle >= this.nextObstacleAt) {
      this._spawnObstacle();
      this.distSinceLastObstacle = 0;
      this.nextObstacleAt = OBSTACLE_SPAWN_DIST_MIN +
        Math.random() * (OBSTACLE_SPAWN_DIST_MAX - OBSTACLE_SPAWN_DIST_MIN);
    }

    // Move Obstacles
    for (const obs of this.obstacles) {
      obs.x -= moveX;
      if (obs.type === 'croissant') {
        obs.rotation += 0.04 * dt;
      } else if (obs.type === 'clock') {
        obs.wiggleTimer += 0.2 * dt;
      }
    }

    // Move Golden Beans
    for (const bean of this.beans) {
      bean.x -= moveX;
      bean.rotation += 0.06 * dt;
      bean.y += Math.sin(performance.now() * 0.005 + bean.x * 0.01) * 0.5 * dt;
    }
    this.beans = this.beans.filter((b) => b.x > -50);

    // Move Sugar Cubes
    for (const sugar of this.sugars) {
      sugar.x -= moveX;
      sugar.rotation += 0.03 * dt;
      sugar.y += Math.cos(performance.now() * 0.006 + sugar.x * 0.01) * 0.6 * dt;
    }
    this.sugars = this.sugars.filter((s) => s.x > -50);

    // Collisions — Obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      if (this._circleRect(this.player, obs)) {
        if (this.sugarRushActive) {
          // Destroys obstacles during Sugar Rush
          this.score += 15;
          if (this.onScoreUpdate) this.onScoreUpdate(this.score);
          this.shakeTimer = 6;
          this.shakeIntensity = 4;
          
          for (let j = 0; j < 12; j++) {
            this.particles.push({
              x: obs.x + obs.w / 2,
              y: obs.y + obs.h / 2,
              vx: (Math.random() - 0.5) * 8 + this.speed * 0.3,
              vy: (Math.random() - 0.5) * 8,
              r: Math.random() * 4 + 2,
              life: 1,
              decay: 0.035,
              color: Math.random() > 0.4 ? COLORS.matchaLight : COLORS.croissantGold,
            });
          }
          this.obstacles.splice(i, 1);
        } else {
          this._die();
          return;
        }
      }
    }

    // Collisions — Golden Beans
    for (let i = this.beans.length - 1; i >= 0; i--) {
      const b = this.beans[i];
      const dx = this.player.x - b.x;
      const dy = this.player.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.player.radius + BEAN_RADIUS) {
        this.score += this.sugarRushActive ? 16 : 8;
        if (this.onScoreUpdate) this.onScoreUpdate(this.score);
        this.player.eyeState = 'wink';
        this.player.eyeTimer = 22;

        for (let j = 0; j < 8; j++) {
          this.particles.push({
            x: b.x, y: b.y,
            vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6,
            r: Math.random() * 3 + 2, life: 1, decay: 0.04,
            color: COLORS.beanGold,
          });
        }
        this.beans.splice(i, 1);
      }
    }

    // Collisions — Sugar Cubes
    for (let i = this.sugars.length - 1; i >= 0; i--) {
      const s = this.sugars[i];
      const dx = this.player.x - s.x;
      const dy = this.player.y - s.y;
      if (Math.sqrt(dx * dx + dy * dy) < this.player.radius + SUGAR_SIZE / 2) {
        this.sugarRushActive = true;
        this.sugarRushTimer = this.sugarRushDuration;
        this.player.eyeState = 'surprised';
        this.player.eyeTimer = 35;

        for (let j = 0; j < 15; j++) {
          this.particles.push({
            x: s.x, y: s.y,
            vx: (Math.random() - 0.5) * 8, vy: (Math.random() - 0.5) * 8,
            r: Math.random() * 4 + 2, life: 1.2, decay: 0.03,
            color: COLORS.matchaLight,
          });
        }
        this.sugars.splice(i, 1);
      }
    }

    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -100);

    this.particles = this.particles.filter((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      return p.life > 0;
    });

    this.coffeeSplashes = this.coffeeSplashes.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 0.22 * dt;
      s.life -= s.decay * dt;
      return s.life > 0;
    });

    if (this.shakeTimer > 0) this.shakeTimer -= dt;
    if (this.flashAlpha > 0) this.flashAlpha -= 0.035 * dt;
  }

  _spawnObstacle() {
    const position = Math.random() > 0.5 ? 'top' : 'bottom';
    
    // 15% chance to spawn a Sugar Cube
    if (Math.random() < 0.15) {
      const sugarY = this.ceilY + 50 + Math.random() * (this.floorY - this.ceilY - 100);
      this.sugars.push({
        x: this.width + 100,
        y: sugarY,
        rotation: Math.random() * Math.PI,
      });
      return;
    }

    const obstacleTypes = ['croissant', 'mug', 'clock'];
    const type = obstacleTypes[Math.floor(Math.random() * obstacleTypes.length)];
    
    let w = 45;
    let h = 55;
    let y = 0;

    if (type === 'croissant') {
      w = 48;
      h = 42;
      const minPlay = this.ceilY + 40;
      const maxPlay = this.floorY - 90;
      y = minPlay + Math.random() * (maxPlay - minPlay);
    } else if (type === 'clock') {
      w = 42;
      h = 42;
      y = this.ceilY + 20 + Math.random() * (this.floorY - this.ceilY - 120);
    } else {
      w = 44;
      h = 60;
      y = position === 'top' ? this.ceilY : this.floorY - h;
    }

    this.obstacles.push({
      type,
      position,
      x: this.width + 100,
      y,
      w,
      h,
      rotation: 0,
      wiggleTimer: 0,
    });

    // Spawn a golden bean near it
    if (Math.random() < COIN_SPAWN_CHANCE) {
      const beanY = position === 'top' ? this.floorY - 60 : this.ceilY + 60;
      this.beans.push({
        x: this.width + 100 + w + 45,
        y: beanY,
        rotation: Math.random() * Math.PI,
      });
    }
  }

  _circleRect(circle, rect) {
    if (rect.type === 'croissant' || rect.type === 'clock') {
      const rx = rect.x + rect.w / 2;
      const ry = rect.y + rect.h / 2;
      const dx = circle.x - rx;
      const dy = circle.y - ry;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist < (circle.radius + Math.min(rect.w, rect.h) * 0.42);
    }

    const cx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.w));
    const cy = Math.max(rect.y, Math.min(circle.y, rect.y + rect.h));
    const dx = circle.x - cx;
    const dy = circle.y - cy;
    return (dx * dx + dy * dy) < (circle.radius * circle.radius);
  }

  _die() {
    this.running = false;
    this.player.eyeState = 'dizzy';

    if (this.score > this.bestScore) {
      this.bestScore = this.score;
      localStorage.setItem('ag_best', this.bestScore.toString());
    }

    this.shakeTimer = 18;
    this.shakeIntensity = 9;
    this.flashAlpha = 0.65;

    // Explode all MATCHA splashes
    const splashColor = COLORS.matchaLiquid;
    for (let i = 0; i < 28; i++) {
      this.coffeeSplashes.push({
        x: this.player.x,
        y: this.player.y,
        vx: (Math.random() - 0.5) * 10 - 2,
        vy: (Math.random() - 0.5) * 12,
        r: Math.random() * 4 + 2,
        color: splashColor,
        life: 1.2,
        decay: 0.02 + Math.random() * 0.015,
      });
    }

    for (let i = 0; i < 15; i++) {
      this.particles.push({
        x: this.player.x,
        y: this.player.y,
        vx: (Math.random() - 0.5) * 8,
        vy: (Math.random() - 0.5) * 8,
        r: Math.random() * 4 + 2,
        life: 1,
        decay: 0.03,
        color: COLORS.slateDark,
      });
    }

    this._deathAnim(25);
  }

  _deathAnim(frames) {
    if (frames <= 0) {
      if (this.onGameOver) this.onGameOver(this.score);
      return;
    }

    const dt = 1;
    this.particles.forEach((p) => {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= p.decay * dt;
    });
    this.coffeeSplashes.forEach((s) => {
      s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 0.22 * dt; s.life -= s.decay * dt;
    });

    if (this.shakeTimer > 0) this.shakeTimer -= dt;
    if (this.flashAlpha > 0) this.flashAlpha -= 0.03 * dt;

    this._draw();
    requestAnimationFrame(() => this._deathAnim(frames - 1));
  }

  _draw() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    let sx = 0, sy = 0;
    if (this.shakeTimer > 0) {
      sx = (Math.random() - 0.5) * this.shakeIntensity;
      sy = (Math.random() - 0.5) * this.shakeIntensity;
    }

    ctx.save();
    ctx.translate(sx, sy);

    // Warm white background
    ctx.fillStyle = COLORS.bgDeep;
    ctx.fillRect(0, 0, w, h);

    // Soft Tan grid lines
    ctx.strokeStyle = this.sugarRushActive ? 'rgba(102, 130, 91, 0.15)' : COLORS.chalkLine;
    ctx.lineWidth = 1.2;
    const gridSize = 80;
    for (let x = 0; x < w; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    for (let y = 0; y < h; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Chalk Board Doodles
    ctx.strokeStyle = 'rgba(140, 98, 57, 0.06)';
    ctx.lineWidth = 1.5;
    for (const decor of this.bgChalkDecor) {
      ctx.save();
      ctx.translate(decor.x, decor.y);
      ctx.rotate(decor.rotation);
      this._drawChalkDoodle(ctx, decor.type, decor.size);
      ctx.restore();
    }

    // Floor & Ceiling bounds (painted dark slate charcoal)
    ctx.fillStyle = COLORS.slateDark;
    ctx.fillRect(0, 0, w, this.ceilY);
    ctx.fillRect(0, this.floorY, w, GROUND_HEIGHT);

    // Trim lines
    ctx.strokeStyle = this.sugarRushActive ? COLORS.matchaLight : COLORS.croissantGold;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, this.ceilY); ctx.lineTo(w, this.ceilY);
    ctx.moveTo(0, this.floorY); ctx.lineTo(w, this.floorY);
    ctx.stroke();

    // Draw Golden Beans (Coins)
    for (const bean of this.beans) {
      ctx.save();
      ctx.translate(bean.x, bean.y);
      ctx.rotate(bean.rotation);
      ctx.shadowColor = COLORS.beanGold;
      ctx.shadowBlur = 8;

      ctx.fillStyle = COLORS.beanGold;
      ctx.strokeStyle = COLORS.slateDark;
      ctx.lineWidth = 1.5;
      
      ctx.beginPath();
      ctx.ellipse(0, 0, BEAN_RADIUS, BEAN_RADIUS * 0.65, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Fold
      ctx.strokeStyle = '#6F4E37';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(-BEAN_RADIUS + 2, 0);
      ctx.quadraticCurveTo(0, -2, BEAN_RADIUS - 2, 0);
      ctx.stroke();

      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // Draw Sugar Cubes (invincibility power-up!)
    for (const sugar of this.sugars) {
      ctx.save();
      ctx.translate(sugar.x, sugar.y);
      ctx.rotate(sugar.rotation);
      ctx.shadowColor = COLORS.matchaLight;
      ctx.shadowBlur = 12;

      ctx.fillStyle = '#FFFFFF';
      ctx.strokeStyle = COLORS.slateDark;
      ctx.lineWidth = 2;
      
      ctx.beginPath();
      ctx.rect(-SUGAR_SIZE / 2, -SUGAR_SIZE / 2, SUGAR_SIZE, SUGAR_SIZE);
      ctx.fill();
      ctx.stroke();

      // Reflect lines
      ctx.strokeStyle = 'rgba(140, 98, 57, 0.2)';
      ctx.beginPath();
      ctx.moveTo(-SUGAR_SIZE / 4, -SUGAR_SIZE / 4);
      ctx.lineTo(-SUGAR_SIZE / 4, SUGAR_SIZE / 4);
      ctx.stroke();

      ctx.restore();
    }
    ctx.shadowBlur = 0;

    // Draw Obstacles
    for (const obs of this.obstacles) {
      ctx.save();
      ctx.translate(obs.x + obs.w / 2, obs.y + obs.h / 2);

      if (obs.type === 'croissant') {
        ctx.rotate(obs.rotation);
        this._drawCroissant(ctx, obs.w, obs.h);
      } else if (obs.type === 'clock') {
        const wiggle = Math.sin(obs.wiggleTimer) * 0.12;
        ctx.rotate(wiggle);
        this._drawClock(ctx, obs.w, obs.h);
      } else {
        if (obs.position === 'top') {
          ctx.scale(1, -1);
        }
        this._drawMug(ctx, obs.w, obs.h);
      }
      ctx.restore();
    }

    // Draw Pip the Coffee Cup (Player)
    if (this.running || this.shakeTimer > 0) {
      ctx.save();
      ctx.translate(this.player.x, this.player.y);
      ctx.rotate(this.player.rotation);
      this._drawPipCup(ctx);
      ctx.restore();
    }

    // Draw Splashes and Particles
    for (const s of this.coffeeSplashes) {
      ctx.globalAlpha = s.life;
      ctx.fillStyle = s.color || COLORS.matchaLiquid;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * s.life, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of this.particles) {
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Death Flash Screen
    if (this.flashAlpha > 0) {
      ctx.fillStyle = `rgba(253, 251, 247, ${this.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    ctx.restore();

    // Idle Bobbing State
    if (!this.started && this.running) {
      ctx.save();
      const bob = Math.sin(performance.now() * 0.0035) * 8;
      ctx.translate(this.player.x, this.height / 2 + bob);
      this._drawPipCup(ctx);
      ctx.restore();
    }
  }

  _drawPipCup(ctx) {
    const r = this.player.radius;

    // Sugar Rush Aura shield
    if (this.sugarRushActive) {
      ctx.strokeStyle = COLORS.matchaLight;
      ctx.lineWidth = 3.5;
      ctx.shadowColor = COLORS.matchaLight;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(0, 0, r + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Glowing aura
    ctx.shadowColor = COLORS.slateDark;
    ctx.shadowBlur = 8;

    let bodyColor = COLORS.classicBody;
    let handleColor = COLORS.classicBody;
    if (this.activeSkin === 'matcha') {
      bodyColor = COLORS.matchaBody;
      handleColor = COLORS.matchaLight;
    } else if (this.activeSkin === 'strawberry') {
      bodyColor = COLORS.strawberryBody;
      handleColor = '#EAA8BA';
    }

    // Draw Cup body
    ctx.fillStyle = bodyColor;
    ctx.strokeStyle = COLORS.slateDark;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.7);
    ctx.lineTo(r, -r * 0.7);
    ctx.quadraticCurveTo(r * 0.9, r, 0, r);
    ctx.quadraticCurveTo(-r * 0.9, r, -r, -r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Matcha liquid filling Pip
    ctx.fillStyle = COLORS.matchaLiquid;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.7, r * 0.90, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Cup handle
    ctx.strokeStyle = COLORS.slateDark;
    ctx.fillStyle = handleColor;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(r - 1, -1, 6, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();

    // Face
    ctx.strokeStyle = COLORS.slateDark;
    ctx.fillStyle = COLORS.slateDark;
    ctx.lineWidth = 2;

    if (this.player.eyeState === 'happy') {
      ctx.beginPath();
      ctx.arc(-5, 0, 2.5, 0, Math.PI, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(5, 0, 2.5, 0, Math.PI, true);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(0, 3, 2, 0, Math.PI);
      ctx.stroke();
    } else if (this.player.eyeState === 'surprised') {
      ctx.beginPath();
      ctx.arc(-5, -1, 3.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, -1, 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, 4, 2.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (this.player.eyeState === 'wink') {
      ctx.beginPath();
      ctx.moveTo(-8, 0); ctx.lineTo(-3, 0);
      ctx.stroke();
      
      ctx.beginPath();
      ctx.arc(4, 0, 2.5, 0, Math.PI, true);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 2, 3, 0, Math.PI);
      ctx.stroke();
    } else if (this.player.eyeState === 'dizzy') {
      ctx.beginPath();
      ctx.moveTo(-7, -2); ctx.lineTo(-3, 2);
      ctx.moveTo(-3, -2); ctx.lineTo(-7, 2);
      ctx.moveTo(3, -2); ctx.lineTo(7, 2);
      ctx.moveTo(7, -2); ctx.lineTo(3, 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-3, 4); ctx.lineTo(3, 4);
      ctx.stroke();
    }
  }

  _drawCroissant(ctx, w, h) {
    ctx.fillStyle = COLORS.croissantGold;
    ctx.strokeStyle = COLORS.slateDark;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.arc(0, 0, w / 2, -Math.PI * 0.2, Math.PI * 1.2);
    ctx.quadraticCurveTo(-10, 0, w / 2 * Math.cos(-Math.PI * 0.2), w / 2 * Math.sin(-Math.PI * 0.2));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = COLORS.croissantShadow;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-12, -4); ctx.quadraticCurveTo(-6, -12, 0, -4);
    ctx.moveTo(-6, 2); ctx.quadraticCurveTo(2, -8, 8, 2);
    ctx.moveTo(2, 8); ctx.quadraticCurveTo(8, 0, 14, 8);
    ctx.stroke();
  }

  _drawClock(ctx, w, h) {
    const r = w / 2;

    ctx.strokeStyle = COLORS.slateDark;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(-r + 4, r - 2); ctx.lineTo(-r - 2, r + 4);
    ctx.moveTo(r - 4, r - 2); ctx.lineTo(r + 2, r + 4);
    ctx.stroke();

    ctx.fillStyle = COLORS.croissantGold;
    ctx.beginPath();
    ctx.arc(-r + 4, -r + 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(r - 4, -r + 4, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = COLORS.slateDark;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -r + 6);
    ctx.moveTo(0, 0); ctx.lineTo(r - 8, 2);
    ctx.stroke();
  }

  _drawMug(ctx, w, h) {
    const mw = w;
    const mh = h;

    ctx.fillStyle = COLORS.slateDark;
    ctx.strokeStyle = COLORS.slateDark;
    ctx.lineWidth = 2;
    this._roundRect(ctx, -mw / 2, -mh / 2, mw, mh, 8);
    ctx.fill();
    ctx.stroke();

    ctx.strokeStyle = COLORS.slateDark;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(-mw / 2 + 1, 0, 8, Math.PI / 2, -Math.PI / 2);
    ctx.stroke();

    ctx.fillStyle = COLORS.matchaDeep;
    ctx.beginPath();
    ctx.ellipse(0, -mh / 2, mw / 2 - 2, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Face
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(-10, -8); ctx.lineTo(-4, -5);
    ctx.moveTo(10, -8); ctx.lineTo(4, -5);
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(-6, -2, 2.5, 0, Math.PI * 2);
    ctx.arc(6, -2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(0, 10, 4, 0, Math.PI, true);
    ctx.stroke();
  }

  _drawChalkDoodle(ctx, type, size) {
    ctx.beginPath();
    if (type === 'cup') {
      ctx.moveTo(-size / 2, -size / 4);
      ctx.lineTo(size / 2, -size / 4);
      ctx.quadraticCurveTo(size * 0.4, size / 2, 0, size / 2);
      ctx.quadraticCurveTo(-size * 0.4, size / 2, -size / 2, -size / 4);
      ctx.moveTo(size / 2, -size * 0.1);
      ctx.arc(size / 2, -size * 0.1, size * 0.2, -Math.PI / 2, Math.PI / 2);
    } else if (type === 'bean') {
      ctx.ellipse(0, 0, size / 2, size / 3, 0.4, 0, Math.PI * 2);
      ctx.moveTo(-size / 2, 0);
      ctx.quadraticCurveTo(0, -2, size / 2, 0);
    } else if (type === 'star') {
      for (let i = 0; i < 5; i++) {
        ctx.lineTo(Math.cos((18 + i * 72) * Math.PI / 180) * size / 2,
                   Math.sin((18 + i * 72) * Math.PI / 180) * size / 2);
        ctx.lineTo(Math.cos((54 + i * 72) * Math.PI / 180) * size / 4,
                   Math.sin((54 + i * 72) * Math.PI / 180) * size / 4);
      }
      ctx.closePath();
    } else {
      ctx.moveTo(-5, size / 2);
      ctx.bezierCurveTo(-10, size / 4, 0, 0, -5, -size / 2);
      ctx.moveTo(5, size / 2);
      ctx.bezierCurveTo(0, size / 4, 10, 0, 5, -size / 2);
    }
    ctx.stroke();
  }

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
