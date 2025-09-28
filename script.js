
// ---------- Utility ----------
function random(min, max) {
  return Math.random() * (max - min) + min;
}

class Snowflake {
  constructor(x, y, radius, opacity, speedY, speedX, amplitude, frequency) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.opacity = opacity;
    this.speedY = speedY;
    this.speedX = speedX;
    this.amplitude = amplitude;
    this.frequency = frequency;
    this.angle = random(0, Math.PI * 2);
  }

  update(width, height) {
    // Vertikalno spuštanje
    this.y += this.speedY;

    // Horizontalno ljuljanje
    this.angle += this.frequency;
    this.x += Math.sin(this.angle) * this.amplitude;

    // Reset kad ispadne ispod
    if (this.y > height) {
      this.y = -this.radius;
      this.x = random(0, width);
      this.angle = random(0, Math.PI * 2);
    }
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(244, 171, 196, ${this.opacity})`; // #F4ABC4
    ctx.fill();
  }
}

// ---------- Klasa: Zvezda padalica ----------
class ShootingStar {
  constructor(x, y, angle, speed, size, opacity, lifeSec = 2.0, trailLen = 16) {
    this.x = x;
    this.y = y;
    this.vx = Math.cos(angle) * speed;   // px/frame (otprilike)
    this.vy = Math.sin(angle) * speed;
    this.size = size;                    // veća od pahuljica (npr. 3.5–6)
    this.opacity = opacity;              // 0.75–1.0
    this.life = lifeSec * 60;            // u frame-ovima (≈ 60fps)
    this.maxLife = this.life;
    this.trail = [];                     // poslednje pozicije
    this.trailLen = trailLen;
    this.dead = false;
  }

  update(width, height) {
    this.life--;

    // Pomeri
    this.x += this.vx;
    this.y += this.vy;

    // Sačuvaj u trag
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > this.trailLen) this.trail.shift();

    // Ako istekne život ili izađe mnogo van platna — ugasi
    const margin = 60;
    if (
      this.life <= 0 ||
      this.x < -margin || this.x > width + margin ||
      this.y < -margin || this.y > height + margin
    ) {
      this.dead = true;
    }
  }

  draw(ctx) {
    // Trag: deblji/svetliji kod glave, tanji/bleđi ka repu
    if (this.trail.length > 1) {
      ctx.lineCap = 'round';
      for (let i = 1; i < this.trail.length; i++) {
        const p0 = this.trail[i - 1];
        const p1 = this.trail[i];

        // t=0 → rep, t=1 → glava (poslednja tačka)
        const t = i / (this.trail.length - 1);
        const head = t; // bliže glavi

        const lifeFade = Math.max(0, this.life / this.maxLife);
        // jači alpha bliže glavi + blago jači kada je sveže "rođena"
        const alpha = this.opacity * (0.25 + 0.75 * head) * (0.6 + 0.4 * lifeFade);

        ctx.strokeStyle = `rgba(244, 171, 196, ${alpha})`;
        // veća debljina bliže glavi
        ctx.lineWidth = Math.max(1, this.size * (0.6 + 1.0 * head));

        ctx.beginPath();
        ctx.moveTo(p0.x, p0.y);
        ctx.lineTo(p1.x, p1.y);
        ctx.stroke();
      }
    }

    // "Glava" zvezde
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(244, 171, 196, ${this.opacity})`;
    ctx.shadowColor = 'rgba(255,235,250,0.8)';
    ctx.shadowBlur = 8 + this.size * 2;
    ctx.fill();
    ctx.shadowBlur = 0; // reset
  }
}

// ---------- Globalne promenljive ----------
let canvas, ctx, width, height;
let snowflakes = [];
let shootingStars = [];

// rAF clock za spawn (umesto setInterval)
const STAR_MIN_SEC = 5;      // min pauza u sekundama
const STAR_MAX_SEC = 10;      // max pauza u sekundama
const STAR_MAX_ACTIVE = 2;    // sigurnosni limit aktivnih kometa

let nextStarInSec = 0;        // odbrojavanje do sledeće komete (sekunde)
let lastTs = performance.now();

// ---------- Inicijalizacija ----------
function initSnow() {
  canvas = document.getElementById('snow-canvas');
  if (!canvas) return;
  ctx = canvas.getContext('2d');

  resizeCanvas();

  // Broj pahulja ~ 1 na 30000 px²
  const snowDensity = (width * height) / 30000;
  const numSnowflakes = Math.round(snowDensity);

  snowflakes = [];
  for (let i = 0; i < numSnowflakes; i++) {
    const radius = random(1, 3);
    const opacity = random(0.2, 0.7);
    const speedFactor = (radius * 0.5) + 0.5; // 0.5..2.0
    const speedY = random(1, 2.5) * speedFactor * 0.3;
    const speedX = random(0.1, 0.5);          // ne koristi se direktno (drift)
    const amplitude = random(0.3, 1.5);
    const frequency = random(0.005, 0.02);

    snowflakes.push(
      new Snowflake(
        random(0, width),
        random(0, height),
        radius,
        opacity,
        speedY,
        speedX,
        amplitude,
        frequency
      )
    );
  }

  // postavi početni timer do sledeće komete
  nextStarInSec = random(STAR_MIN_SEC, STAR_MAX_SEC);

  animate();
}

// ---------- Canvas dimenzije ----------
function resizeCanvas() {
  width = window.innerWidth;
  height = window.innerHeight;
  if (canvas) {
    canvas.width = width;
    canvas.height = height;
  }
}

// ---------- Spawner za zvezdu padalicu ----------
function spawnShootingStar() {
  if (!width || !height) return;

  // Limit aktivnih
  if (shootingStars.length >= STAR_MAX_ACTIVE) return;

  // Nasumična početna tačka bilo gde unutar platna
  const startX = random(0, width);
  const startY = random(0, height);

  // Nasumičan smer (ugao u radijanima)
  const angle = random(0, Math.PI * 2);

  // Brža od pahuljica
  const speed = random(8, 14); // px/frame

  // Veća od pahuljica
  const size = random(3.5, 6);

  // Jači opacity
  const opacity = random(0.8, 1.0);

  // Trajanje 1.6–2.6 s
  const lifeSec = random(4, 4);

  shootingStars.push(
    new ShootingStar(startX, startY, angle, speed, size, opacity, lifeSec, 16)
  );
}

// ---------- Glavna petlja ----------
function animate() {
  requestAnimationFrame(animate);

  // vreme / dt
  const now = performance.now();
  const dt = Math.min((now - lastTs) / 1000, 0.1); // u sekundama, clamp radi stabilnosti
  lastTs = now;

  // Odbrojavaj do sledeće komete (dok je tab aktivan rAF radi; u backgroundu stoji)
  nextStarInSec -= dt;
  if (nextStarInSec <= 0) {
    spawnShootingStar();
    nextStarInSec = random(STAR_MIN_SEC, STAR_MAX_SEC);
  }

  // Očisti platno
  ctx.clearRect(0, 0, width, height);

  // Pahulje
  for (const flake of snowflakes) {
    flake.update(width, height);
    flake.draw(ctx);
  }

  // Zvezde padalice (crtamo POSLE pahulja da budu iznad)
  for (const star of shootingStars) {
    star.update(width, height);
    star.draw(ctx);
  }
  // Ukloni završene
  shootingStars = shootingStars.filter(s => !s.dead);
}

// ---------- Event listener-i ----------
window.addEventListener('load', initSnow);
window.addEventListener('resize', () => { if (canvas) resizeCanvas(); });

// (opciono) Ako baš želiš da budeš siguran, možeš čistiti i na promenu vidljivosti:
// document.addEventListener('visibilitychange', () => {
//   if (document.hidden) {
//     // ništa – rAF stoji, spawn ide preko rAF clocka, ne gomila
//   } else {
//     // resetuj tajmer tako da ne spawnuje baš odmah po povratku
//     nextStarInSec = random(STAR_MIN_SEC, STAR_MAX_SEC);
//   }
// });
