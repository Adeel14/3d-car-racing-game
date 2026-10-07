import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x90cdf4);
scene.fog = new THREE.Fog(0x90cdf4, 35, 180);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 5.5, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.HemisphereLight(0xffffff, 0x204060, 1.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 12, 10);
scene.add(sunLight);

const world = new THREE.Group();
scene.add(world);

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3748 });
const laneLineMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f4f5 });
const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x5fae68 });
const skylineMaterial = new THREE.MeshStandardMaterial({ color: 0xb7d3ec });

const roadSegments = [];
for (let i = 0; i < 9; i += 1) {
  const segment = new THREE.Group();

  const road = new THREE.Mesh(new THREE.BoxGeometry(8, 0.35, 22), roadMaterial);
  road.position.y = -0.2;
  segment.add(road);

  const leftCurb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 22), curbMaterial);
  leftCurb.position.set(-4.5, 0.1, 0);
  segment.add(leftCurb);

  const rightCurb = leftCurb.clone();
  rightCurb.position.x = 4.5;
  segment.add(rightCurb);

  [-2, 2].forEach((x) => {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 2.2), laneLineMaterial);
    marker.position.set(x, 0.3, 0);
    segment.add(marker);
  });

  segment.position.z = -i * 22;
  world.add(segment);
  roadSegments.push(segment);
}

const grassLeft = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 220), grassMaterial);
grassLeft.position.set(-16, -0.5, -60);
scene.add(grassLeft);

const grassRight = grassLeft.clone();
grassRight.position.x = 16;
scene.add(grassRight);

for (let i = 0; i < 22; i += 1) {
  const building = new THREE.Mesh(
    new THREE.BoxGeometry(2 + Math.random() * 2.2, 5 + Math.random() * 12, 2 + Math.random() * 2.2),
    skylineMaterial
  );
  building.position.set(-18 + Math.random() * 36, building.geometry.parameters.height / 2 - 1.5, -40 - Math.random() * 120);
  scene.add(building);
}

function createCar(color = 0xff3b30) {
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.7, 3.2),
    new THREE.MeshStandardMaterial({ color, metalness: 0.28, roughness: 0.5 })
  );
  body.position.y = 0.55;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.55, 1.7),
    new THREE.MeshStandardMaterial({ color: 0xdfe7f1, metalness: 0.35, roughness: 0.25 })
  );
  cabin.position.set(0, 1.05, -0.15);
  car.add(cabin);

  const wheelGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 16);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.9 });
  const wheelPositions = [
    [-0.9, 0.2, 1.1],
    [0.9, 0.2, 1.1],
    [-0.9, 0.2, -1.1],
    [0.9, 0.2, -1.1],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    car.add(wheel);
  });

  car.userData = { width: 1.7, depth: 3.2 };
  return car;
}

function createCoin() {
  const coin = new THREE.Mesh(
    new THREE.TorusGeometry(0.55, 0.18, 12, 24),
    new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0x7c4f00, metalness: 0.7, roughness: 0.35 })
  );
  coin.rotation.x = Math.PI / 2;
  coin.position.y = 1.4;
  return coin;
}

const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const coinsEl = document.getElementById('coins');
const healthFill = document.getElementById('healthFill');
const message = document.getElementById('message');
const pauseMenu = document.getElementById('pauseMenu');
const gameOverScreen = document.getElementById('gameOverScreen');
const startButton = document.getElementById('startButton');
const playAgainBtn = document.getElementById('playAgainBtn');
const resumeBtn = document.getElementById('resumeBtn');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');
const easyBtn = document.getElementById('easyBtn');
const normalBtn = document.getElementById('normalBtn');
const hardBtn = document.getElementById('hardBtn');

const finalScoreEl = document.getElementById('finalScore');
const finalDistanceEl = document.getElementById('finalDistance');
const finalCoinsEl = document.getElementById('finalCoins');
const bestScoreEl = document.getElementById('bestScore');

const laneOffsets = [-2.2, 0, 2.2];
const obstacleCars = [];
const coinMeshes = [];
const keys = {};

const state = {
  difficulty: 'normal',
  started: false,
  paused: false,
  gameOver: false,
  score: 0,
  distance: 0,
  coins: 0,
  health: 100,
  speed: 24,
  targetX: 0,
  bestScore: Number(localStorage.getItem('bestScore') || 0),
};

const difficultyMap = {
  easy: { speed: 22, obstacleDensity: 2.1, coinFrequency: 1.8, health: 120 },
  normal: { speed: 28, obstacleDensity: 1.7, coinFrequency: 1.5, health: 100 },
  hard: { speed: 34, obstacleDensity: 1.35, coinFrequency: 1.25, health: 85 },
};

const player = createCar(0x22c55e);
player.position.set(0, 0.5, 7);
scene.add(player);

function setDifficulty(level) {
  state.difficulty = level;
  [easyBtn, normalBtn, hardBtn].forEach((btn) => btn.classList.remove('active'));
  if (level === 'easy') easyBtn.classList.add('active');
  if (level === 'normal') normalBtn.classList.add('active');
  if (level === 'hard') hardBtn.classList.add('active');
}

function resetGame() {
  state.score = 0;
  state.coins = 0;
  state.distance = 0;
  state.health = difficultyMap[state.difficulty].health;
  state.speed = difficultyMap[state.difficulty].speed;
  state.targetX = 0;
  state.started = true;
  state.paused = false;
  state.gameOver = false;

  player.position.set(0, 0.5, 7);
  player.rotation.z = 0;

  obstacleCars.forEach((car) => scene.remove(car));
  obstacleCars.length = 0;

  coinMeshes.forEach((coin) => scene.remove(coin));
  coinMeshes.length = 0;

  for (let i = 0; i < 5; i += 1) spawnTrafficCar();
  for (let i = 0; i < 5; i += 1) spawnCoin();

  updateHud();
  pauseMenu.classList.remove('visible');
  gameOverScreen.classList.remove('visible');
  message.classList.remove('visible');
}

function updateHud() {
  scoreEl.textContent = Math.floor(state.score).toString();
  speedEl.textContent = Math.round(state.speed).toString();
  coinsEl.textContent = state.coins.toString();
  const healthPercent = THREE.MathUtils.clamp(state.health / difficultyMap[state.difficulty].health, 0, 1) * 100;
  healthFill.style.width = `${healthPercent}%`;
  bestScoreEl.textContent = state.bestScore.toString();
}

function spawnTrafficCar() {
  const car = createCar(Math.random() > 0.5 ? 0xf97316 : 0xef4444);
  const lane = laneOffsets[Math.floor(Math.random() * laneOffsets.length)];
  car.position.set(lane, 0.5, -35 - Math.random() * 90);
  car.rotation.y = Math.PI;
  scene.add(car);
  obstacleCars.push(car);
}

function spawnCoin() {
  const coin = createCoin();
  const lane = laneOffsets[Math.floor(Math.random() * laneOffsets.length)];
  coin.position.set(lane, 1.6, -20 - Math.random() * 110);
  scene.add(coin);
  coinMeshes.push(coin);
}

function movePlayer(dt) {
  if (!state.started || state.paused || state.gameOver) return;

  if (keys.a || keys.arrowleft) state.targetX -= 10 * dt;
  if (keys.d || keys.arrowright) state.targetX += 10 * dt;

  state.targetX = THREE.MathUtils.clamp(state.targetX, -3.5, 3.5);
  player.position.x += (state.targetX - player.position.x) * 0.12;
  player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, (state.targetX - player.position.x) * 0.18, 0.08);
}

function updateRoad(dt) {
  roadSegments.forEach((segment) => {
    segment.position.z += state.speed * dt;
    if (segment.position.z > 22) {
      segment.position.z = -roadSegments.length * 22 + 22;
    }
  });
}

function checkCollision(a, b, dxLimit = 1.2, dzLimit = 2.5) {
  const dx = Math.abs(a.position.x - b.position.x);
  const dz = Math.abs(a.position.z - b.position.z);
  return dx < dxLimit && dz < dzLimit;
}

function handleTraffic(dt) {
  for (let i = obstacleCars.length - 1; i >= 0; i -= 1) {
    const car = obstacleCars[i];
    car.position.z += state.speed * dt * 1.22;

    if (car.position.z > 20) {
      scene.remove(car);
      obstacleCars.splice(i, 1);
      spawnTrafficCar();
      continue;
    }

    if (checkCollision(player, car)) {
      state.health -= 30;
      if (state.health <= 0) {
        endGame();
        return;
      }
      player.position.x = THREE.MathUtils.clamp(player.position.x + (Math.random() - 0.5) * 2.5, -3.5, 3.5);
      state.score = Math.max(0, state.score - 35);
      scene.remove(car);
      obstacleCars.splice(i, 1);
      spawnTrafficCar();
    }
  }
}

function handleCoins(dt) {
  for (let i = coinMeshes.length - 1; i >= 0; i -= 1) {
    const coin = coinMeshes[i];
    coin.position.z += state.speed * dt * 1.18;
    coin.rotation.z += 0.2;

    if (coin.position.z > 20) {
      scene.remove(coin);
      coinMeshes.splice(i, 1);
      spawnCoin();
      continue;
    }

    if (checkCollision(player, coin, 1.1, 1.6)) {
      scene.remove(coin);
      coinMeshes.splice(i, 1);
      state.coins += 1;
      state.score += 60;
      spawnCoin();
    }
  }
}

function togglePause() {
  if (!state.started || state.gameOver) return;
  state.paused = !state.paused;
  pauseMenu.classList.toggle('visible', state.paused);
}

function endGame() {
  state.started = false;
  state.gameOver = true;
  state.bestScore = Math.max(state.bestScore, Math.floor(state.score));
  localStorage.setItem('bestScore', String(state.bestScore));

  finalScoreEl.textContent = Math.floor(state.score).toString();
  finalDistanceEl.textContent = Math.floor(state.distance).toString();
  finalCoinsEl.textContent = state.coins.toString();
  bestScoreEl.textContent = state.bestScore.toString();

  gameOverScreen.classList.add('visible');
  pauseMenu.classList.remove('visible');
}

function handleRaceProgress(dt) {
  state.distance += state.speed * dt * 0.6;
  state.score += dt * (10 + state.speed * 0.5);
  state.speed = difficultyMap[state.difficulty].speed + Math.min(20, state.distance * 0.03);
}

function startRace() {
  resetGame();
}

function showMainMenu() {
  state.started = false;
  state.paused = false;
  state.gameOver = false;
  message.classList.add('visible');
  pauseMenu.classList.remove('visible');
  gameOverScreen.classList.remove('visible');
  updateHud();
}

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (key === 'p') togglePause();
  if (key === 'r' && state.gameOver) startRace();
  if (key === 'm') showMainMenu();
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

startButton.addEventListener('click', () => startRace());
playAgainBtn.addEventListener('click', () => startRace());
resumeBtn.addEventListener('click', () => togglePause());
restartBtn.addEventListener('click', () => startRace());
menuBtn.addEventListener('click', () => showMainMenu());

easyBtn.addEventListener('click', () => setDifficulty('easy'));
normalBtn.addEventListener('click', () => setDifficulty('normal'));
hardBtn.addEventListener('click', () => setDifficulty('hard'));

const clock = new THREE.Clock();
setDifficulty('normal');
updateHud();
showMainMenu();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());

  if (state.started && !state.paused && !state.gameOver) {
    movePlayer(dt);
    updateRoad(dt);
    handleTraffic(dt);
    handleCoins(dt);
    handleRaceProgress(dt);
    updateHud();
  }

  camera.position.x += (player.position.x * 0.5 - camera.position.x) * 0.08;
  camera.position.y = 5.5;
  camera.lookAt(player.position.x * 0.35, 0.7, -10);

  renderer.render(scene, camera);
}

animate();
