import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.157.0/build/three.module.js';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x90cdf4);
scene.fog = new THREE.Fog(0x90cdf4, 30, 160);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(0, 5.5, 12);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const ambientLight = new THREE.HemisphereLight(0xffffff, 0x274060, 1.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
sunLight.position.set(5, 12, 8);
scene.add(sunLight);

const world = new THREE.Group();
scene.add(world);

const roadMaterial = new THREE.MeshStandardMaterial({ color: 0x2d3748 });
const laneLineMaterial = new THREE.MeshStandardMaterial({ color: 0xf4f4f5 });
const curbMaterial = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
const grassMaterial = new THREE.MeshStandardMaterial({ color: 0x5fae68 });

const roadSegments = [];
for (let i = 0; i < 7; i += 1) {
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

  const laneMarkerPositions = [-2, 2];
  for (const x of laneMarkerPositions) {
    const marker = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 2.2), laneLineMaterial);
    marker.position.set(x, 0.3, 0);
    segment.add(marker);
  }

  segment.position.z = -i * 22;
  world.add(segment);
  roadSegments.push(segment);
}

const grassLeft = new THREE.Mesh(new THREE.BoxGeometry(30, 0.1, 220), grassMaterial);
grassLeft.position.set(-16, -0.5, -40);
scene.add(grassLeft);

const grassRight = grassLeft.clone();
grassRight.position.x = 16;
scene.add(grassRight);

const skylineMaterial = new THREE.MeshStandardMaterial({ color: 0xb7d3ec });
for (let i = 0; i < 18; i += 1) {
  const building = new THREE.Mesh(new THREE.BoxGeometry(2 + Math.random() * 2, 4 + Math.random() * 12, 2 + Math.random() * 2), skylineMaterial);
  building.position.set(-18 + Math.random() * 36, building.geometry.parameters.height / 2 - 1.5, -40 - Math.random() * 90);
  scene.add(building);
}

function createCar(color = 0xff3b30) {
  const car = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.7, 3.2),
    new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.55 })
  );
  body.position.y = 0.55;
  car.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 0.55, 1.7),
    new THREE.MeshStandardMaterial({ color: 0xdfe7f1, metalness: 0.4, roughness: 0.2 })
  );
  cabin.position.set(0, 1.05, -0.15);
  car.add(cabin);

  const wheelGeometry = new THREE.CylinderGeometry(0.32, 0.32, 0.25, 16);
  const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const wheelPositions = [
    [-0.9, 0.2, 1.0],
    [0.9, 0.2, 1.0],
    [-0.9, 0.2, -1.0],
    [0.9, 0.2, -1.0],
  ];

  wheelPositions.forEach(([x, y, z]) => {
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(x, y, z);
    car.add(wheel);
  });

  car.userData = { width: 1.7, depth: 3.2, height: 1.5 };
  return car;
}

const player = createCar(0x22c55e);
player.position.set(0, 0.5, 7);
scene.add(player);

const obstacleCars = [];
const laneOffsets = [-2.2, 0, 2.2];

const scoreEl = document.getElementById('score');
const speedEl = document.getElementById('speed');
const message = document.getElementById('message');
const startButton = document.getElementById('startButton');

let isStarted = false;
let gameOver = false;
let score = 0;
let elapsed = 0;
let currentSpeed = 24;
let targetX = 0;

const keys = {};

window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (key === 'r' && gameOver) {
    resetGame();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.key.toLowerCase()] = false;
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function startRace() {
  isStarted = true;
  gameOver = false;
  message.classList.remove('visible');
  resetGame();
}

function resetGame() {
  score = 0;
  elapsed = 0;
  currentSpeed = 24;
  targetX = 0;
  player.position.set(0, 0.5, 7);
  player.rotation.z = 0;

  obstacleCars.forEach((car) => scene.remove(car));
  obstacleCars.length = 0;

  for (let i = 0; i < 5; i += 1) {
    spawnObstacle();
  }

  updateHud();
  gameOver = false;
}

function spawnObstacle() {
  const car = createCar(Math.random() > 0.5 ? 0xf97316 : 0xef4444);
  const lane = laneOffsets[Math.floor(Math.random() * laneOffsets.length)];
  car.position.set(lane, 0.5, -45 - Math.random() * 120);
  car.rotation.y = Math.PI;
  scene.add(car);
  obstacleCars.push(car);
}

function updateHud() {
  scoreEl.textContent = Math.floor(score).toString();
  speedEl.textContent = Math.round(currentSpeed).toString();
}

function movePlayer(dt) {
  if (!isStarted || gameOver) return;

  if (keys.a || keys.arrowleft) targetX -= 10 * dt;
  if (keys.d || keys.arrowright) targetX += 10 * dt;

  targetX = THREE.MathUtils.clamp(targetX, -3.5, 3.5);
  player.position.x += (targetX - player.position.x) * 0.12;
  player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, (targetX - player.position.x) * 0.15, 0.08);
}

function updateRoad(dt) {
  roadSegments.forEach((segment, index) => {
    segment.position.z += currentSpeed * dt;
    if (segment.position.z > 22) {
      segment.position.z = -roadSegments.length * 22 + 22;
    }
  });
}

function updateTraffic(dt) {
  for (let i = obstacleCars.length - 1; i >= 0; i -= 1) {
    const car = obstacleCars[i];
    car.position.z += currentSpeed * dt * 1.2;

    if (car.position.z > 18) {
      scene.remove(car);
      obstacleCars.splice(i, 1);
      spawnObstacle();
      continue;
    }

    if (checkCollision(player, car)) {
      triggerCrash();
      break;
    }
  }
}

function checkCollision(playerCar, otherCar) {
  const dx = Math.abs(playerCar.position.x - otherCar.position.x);
  const dz = Math.abs(playerCar.position.z - otherCar.position.z);

  return dx < 1.2 && dz < 2.5;
}

function triggerCrash() {
  gameOver = true;
  isStarted = false;
  message.classList.add('visible');
  message.innerHTML = `
    <h1>Crash!</h1>
    <p>Your score: ${Math.floor(score)}</p>
    <p>Press R to restart</p>
    <button id="startButton">Race Again</button>
  `;
  document.getElementById('startButton').addEventListener('click', () => {
    startRace();
  });
}

startButton.addEventListener('click', () => {
  startRace();
});

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.033, clock.getDelta());

  if (isStarted && !gameOver) {
    elapsed += dt;
    score += dt * 10;
    currentSpeed = 24 + Math.min(30, elapsed * 1.2);
    movePlayer(dt);
    updateRoad(dt);
    updateTraffic(dt);
    updateHud();
  }

  camera.position.x += (player.position.x * 0.5 - camera.position.x) * 0.08;
  camera.lookAt(player.position.x * 0.35, 0.6, -10);

  renderer.render(scene, camera);
}

const clock = new THREE.Clock();
resetGame();
message.classList.add('visible');
animate();

