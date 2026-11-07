import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const LARGE = 840;
const SMALL = 420;
const COLORS = {
  violet: '#8a66fc', lilac: '#c9b3fb', aqua: '#60e4d8', teal: '#2fc4b6', pink: '#f696fc', rose: '#f8b4fd',
  orange: '#ffa760', coral: '#ff7e5f', yellow: '#ffe28a', cream: '#ffecac', blue: '#4a66d4', sky: '#7fb4f5',
  white: '#fbfbfb', ink: '#221b3d',
};

const clay = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
  color: COLORS[color] ?? color, roughness: 0.46, metalness: 0, clearcoat: 0.35, clearcoatRoughness: 0.4,
  ...extra,
});

const glass = (color, opacity = 0.34) => clay(color, {
  transparent: true, opacity, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: false,
});

function mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
  const item = new THREE.Mesh(geometry, material);
  item.position.set(...position);
  item.rotation.set(...rotation);
  return item;
}

const lathe = (points, material, segments = 96) => mesh(
  new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), segments), material);

function smooth(points, divisions = 80) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)));
  return curve.getPoints(divisions).map((p) => [Math.max(p.x, 0), p.y]);
}

function tube(points, radius, material) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  return mesh(new THREE.TubeGeometry(curve, 64, radius, 24), material);
}

function lensShape() {
  const group = new THREE.Group();
  group.add(mesh(new THREE.TorusGeometry(1.08, 0.26, 48, 128), clay('aqua')));
  group.add(mesh(new THREE.SphereGeometry(1.05, 64, 64).scale(1, 1, 0.28), glass('#d8f8ff', 0.5)));
  const handle = new THREE.Group();
  handle.add(mesh(new THREE.CapsuleGeometry(0.25, 1.2, 16, 48), clay('orange'), [0, -0.92, 0]));
  handle.add(mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.42, 48), clay('pink'), [0, -0.12, 0]));
  handle.position.set(0.86, -0.86, 0);
  handle.rotation.z = Math.PI / 4;
  group.add(handle);
  group.add(mesh(new THREE.SphereGeometry(0.15, 32, 32), clay('white'), [-0.42, 0.44, 0.3]));
  return group;
}

function lens() {
  const group = lensShape();
  group.rotation.set(0.2, -0.5, 0.05);
  return group;
}

function bellShape() {
  const group = new THREE.Group();
  group.add(lathe(smooth([[0, 1.42], [0.3, 1.38], [0.56, 1.1], [0.72, 0.5], [0.86, -0.1], [1.2, -0.62], [1.32, -0.82], [1.1, -0.86]]),
    clay('yellow', { side: THREE.DoubleSide })));
  group.add(mesh(new THREE.TorusGeometry(1.2, 0.1, 32, 128), clay('pink'), [0, -0.8, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.3, 48, 48), clay('coral'), [0.05, -1.06, 0.1]));
  group.add(mesh(new THREE.TorusGeometry(0.19, 0.07, 24, 64), clay('violet'), [0, 1.58, 0]));
  return group;
}

function bell() {
  const group = bellShape();
  group.rotation.set(0.1, -0.3, -0.22);
  return group;
}

function flaskShape() {
  const group = new THREE.Group();
  const outline = smooth([[0, -1.5], [0.8, -1.46], [1.2, -1.2], [1.12, -0.7], [0.56, 0.3], [0.36, 0.9], [0.36, 1.32]]);
  group.add(lathe(outline, glass('#e8f7ff', 0.4)));
  const liquid = smooth([[0, -1.42], [0.76, -1.38], [1.12, -1.14], [1.04, -0.68], [0.72, -0.14]]).concat([[0, -0.14]]);
  group.add(lathe(liquid, clay('aqua')));
  group.add(mesh(new THREE.CircleGeometry(0.72, 64), clay('rose'), [0, -0.13, 0], [-Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.42, 0.075, 24, 96), clay('white'), [0, 1.34, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.46, 64), clay('orange'), [0, 1.52, 0]));
  [[-0.4, -0.7, 0.72, 0.13], [0.3, -0.98, 0.76, 0.18], [0.1, -0.42, 0.56, 0.09]]
    .forEach(([x, y, z, r]) => group.add(mesh(new THREE.SphereGeometry(r, 32, 32), clay('white'), [x, y, z])));
  return group;
}

function robotHead() {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CapsuleGeometry(1.05, 0.5, 24, 96).rotateZ(Math.PI / 2), clay('white')));
  group.add(mesh(new THREE.CapsuleGeometry(0.72, 0.44, 24, 96).rotateZ(Math.PI / 2).scale(1, 1, 0.5), clay('ink', { roughness: 0.2 }), [0, 0.02, 0.72]));
  const eye = new THREE.CapsuleGeometry(0.17, 0.16, 16, 48);
  const glow = clay('aqua', { emissive: COLORS.aqua, emissiveIntensity: 0.9 });
  group.add(mesh(eye, glow, [-0.42, 0.04, 1.08]));
  group.add(mesh(eye, glow, [0.42, 0.04, 1.08]));
  const ear = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 64);
  group.add(mesh(ear, clay('violet'), [-1.34, 0, 0], [0, 0, Math.PI / 2]));
  group.add(mesh(ear, clay('violet'), [1.34, 0, 0], [0, 0, Math.PI / 2]));
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 24), clay('violet'), [0, 1.24, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.17, 32, 32), clay('pink'), [0, 1.56, 0]));
  return group;
}

function bot() {
  const group = robotHead();
  group.rotation.set(0.12, -0.34, 0.1);
  return group;
}

function barChart() {
  const group = new THREE.Group();
  [[-0.5, 0.7, 'pink'], [0, 1.15, 'orange'], [0.5, 1.6, 'aqua']].forEach(([x, height, color]) => {
    group.add(mesh(new RoundedBoxGeometry(0.4, height, 0.4, 6, 0.14), clay(color), [x, height / 2, 0]));
  });
  return group;
}

function mascot() {
  const group = new THREE.Group();
  const sweater = clay('blue');
  group.add(lathe(smooth([[0, -2.7], [1.16, -2.7], [1.5, -2], [1.56, -1.1], [1.36, -0.3], [0.8, 0.28], [0, 0.42]]), sweater));
  group.add(mesh(new THREE.TorusGeometry(0.62, 0.17, 24, 96), clay('sky'), [0, 0.38, 0], [Math.PI / 2, 0, 0]));

  const head = robotHead();
  head.scale.setScalar(0.92);
  head.position.set(0, 1.42, 0.05);
  head.rotation.set(0.08, -0.12, 0);
  group.add(head);

  group.add(tube([[-1.32, -0.42, 0], [-2.2, -1.1, 0.35], [-2.74, -0.1, 0.65]], 0.34, sweater));
  group.add(tube([[1.32, -0.42, 0], [2.2, -1.1, 0.35], [2.74, -0.1, 0.65]], 0.34, sweater));
  group.add(mesh(new THREE.SphereGeometry(0.36, 48, 48), clay('white'), [-2.76, 0.16, 0.68]));
  group.add(mesh(new THREE.SphereGeometry(0.36, 48, 48), clay('white'), [2.76, 0.16, 0.68]));

  const magnifier = lensShape();
  magnifier.scale.setScalar(0.62);
  magnifier.position.set(-3.02, 1.12, 0.74);
  magnifier.rotation.set(0.1, 0.2, -0.62);
  group.add(magnifier);

  const chart = barChart();
  chart.scale.setScalar(0.92);
  chart.position.set(2.82, 0.46, 0.74);
  chart.rotation.set(0.12, -0.32, -0.08);
  group.add(chart);

  group.rotation.set(0.04, -0.12, 0);
  return group;
}

function rocket() {
  const group = new THREE.Group();
  const ship = new THREE.Group();
  ship.add(lathe(smooth([[0, -1.7], [0.62, -1.62], [0.98, -0.8], [1.04, 0.1], [0.82, 1.1], [0.42, 1.86], [0, 2.2]]), clay('white')));
  ship.add(lathe(smooth([[0.6, 1.3], [0.42, 1.86], [0.2, 2.1], [0, 2.22]]), clay('coral')));
  ship.add(lathe(smooth([[0, -1.72], [0.56, -1.7], [0.72, -1.36]]), clay('violet')));
  ship.add(mesh(new THREE.TorusGeometry(0.44, 0.12, 32, 96), clay('violet'), [0, 0.48, 0.92], [0.08, 0, 0]));
  ship.add(mesh(new THREE.SphereGeometry(0.36, 48, 48).scale(1, 1, 0.5), clay('aqua', { roughness: 0.2 }), [0, 0.48, 0.92]));
  const fin = new THREE.Shape();
  fin.moveTo(0, 0);
  fin.quadraticCurveTo(0.95, -0.2, 1.1, -1.25);
  fin.quadraticCurveTo(0.45, -1.02, 0, -1.02);
  fin.closePath();
  const finGeometry = new THREE.ExtrudeGeometry(fin, { depth: 0.2, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 6 });
  [0, 2.094, 4.189].forEach((angle) => {
    const holder = new THREE.Group();
    holder.rotation.y = angle + 0.5;
    holder.add(mesh(finGeometry, clay('coral'), [0.82, -0.42, -0.1]));
    ship.add(holder);
  });
  ship.add(lathe(smooth([[0, -2.9], [0.3, -2.4], [0.48, -1.9], [0, -1.7]]), clay('orange', { emissive: COLORS.orange, emissiveIntensity: 0.25 })));
  ship.rotation.set(0.1, -0.2, -0.86);
  group.add(ship);
  [[-2.1, -1.56, 0.74], [-3, -2.06, 0.94], [-2.1, -2.3, 0.68], [-3.92, -2.6, 0.78], [-3.1, -2.96, 0.6], [-4.7, -3.02, 0.5]]
    .forEach(([x, y, r]) => group.add(mesh(new THREE.SphereGeometry(r, 48, 48), clay('white'), [x, y, 0.1])));
  return group;
}

function cloud() {
  const group = new THREE.Group();
  [[-1.1, -0.14, 0.72], [-0.2, 0.28, 1.02], [0.86, 0.02, 0.84], [1.62, -0.26, 0.5], [-1.76, -0.36, 0.42]]
    .forEach(([x, y, r]) => group.add(mesh(new THREE.SphereGeometry(r, 48, 48), clay('white', { roughness: 0.7, clearcoat: 0 }), [x, y, 0])));
  group.add(mesh(new RoundedBoxGeometry(3.6, 0.6, 1, 8, 0.3), clay('white', { roughness: 0.7, clearcoat: 0 }), [0, -0.5, 0]));
  return group;
}

function tile(color, build) {
  return () => {
    const group = new THREE.Group();
    group.add(mesh(new RoundedBoxGeometry(2.5, 2.5, 0.7, 16, 0.42), clay(color, { clearcoat: 0.7, clearcoatRoughness: 0.25 })));
    const emblem = build();
    emblem.position.z = 0.46;
    group.add(emblem);
    group.rotation.set(0.28, -0.42, 0.12);
    return group;
  };
}

function targetEmblem() {
  const group = new THREE.Group();
  group.add(mesh(new THREE.TorusGeometry(0.72, 0.17, 32, 96), clay('white')));
  group.add(mesh(new THREE.SphereGeometry(0.28, 48, 48), clay('white')));
  group.add(mesh(new THREE.CapsuleGeometry(0.13, 0.52, 12, 32), clay('white'), [0.74, -0.74, 0], [0, 0, Math.PI / 4]));
  return group;
}

function bellEmblem() {
  const group = bellShape();
  group.scale.setScalar(0.62);
  group.position.y = 0.04;
  return group;
}

function flaskEmblem() {
  const group = flaskShape();
  group.scale.setScalar(0.62);
  return group;
}

function clipboardEmblem() {
  const group = new THREE.Group();
  group.add(mesh(new RoundedBoxGeometry(1.34, 1.66, 0.2, 8, 0.1), clay('violet'), [0, -0.08, 0]));
  group.add(mesh(new RoundedBoxGeometry(1.04, 1.32, 0.1, 6, 0.04), clay('white'), [0, -0.12, 0.12]));
  group.add(mesh(new RoundedBoxGeometry(0.62, 0.26, 0.2, 6, 0.08), clay('ink'), [0, 0.74, 0.14]));
  group.add(tube([[-0.34, -0.14, 0.22], [-0.08, -0.42, 0.22], [0.38, 0.14, 0.22]], 0.09, clay('violet')));
  return group;
}

function chartEmblem() {
  const group = barChart();
  group.position.set(0, -0.78, 0);
  return group;
}

function chatEmblem() {
  const group = new THREE.Group();
  group.add(mesh(new RoundedBoxGeometry(1.6, 1.16, 0.3, 10, 0.14), clay('white'), [0, 0.12, 0]));
  group.add(mesh(new THREE.ConeGeometry(0.2, 0.4, 24), clay('white'), [-0.42, -0.5, 0], [0, 0, 0.5]));
  [-0.42, 0, 0.42].forEach((x) => group.add(mesh(new THREE.SphereGeometry(0.12, 32, 32), clay('violet'), [x, 0.12, 0.17])));
  return group;
}

function docEmblem() {
  const group = new THREE.Group();
  group.add(mesh(new RoundedBoxGeometry(1.32, 1.66, 0.14, 6, 0.06), clay('white')));
  group.add(mesh(new RoundedBoxGeometry(0.9, 0.46, 0.08, 4, 0.03), clay('aqua'), [0, 0.42, 0.09]));
  [-0.12, -0.38, -0.62].forEach((y) => group.add(mesh(new RoundedBoxGeometry(0.9, 0.11, 0.06, 4, 0.02), clay('lilac'), [0, y, 0.09])));
  return group;
}

function dotsEmblem() {
  const group = new THREE.Group();
  group.add(mesh(new RoundedBoxGeometry(1.8, 0.86, 0.2, 8, 0.2), clay('white')));
  [[-0.54, 'coral'], [-0.18, 'orange'], [0.18, 'aqua'], [0.54, 'violet']].forEach(([x, color]) => {
    group.add(mesh(new THREE.SphereGeometry(0.14, 32, 32), clay(color), [x, 0, 0.14]));
  });
  return group;
}

function render(build, size) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(size, size, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.08).texture;
  scene.environmentIntensity = 0.62;

  const key = new THREE.DirectionalLight('#ffffff', 1.5);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#c9a9ff', 1.3);
  rim.position.set(5, 1, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#9fe8ff', 0.7);
  fill.position.set(4, -4, 4);
  scene.add(fill);

  const object = build();
  scene.add(object);
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);
  const radius = box.getSize(new THREE.Vector3()).length() / 2;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 100);
  camera.position.set(0, 0, (radius / Math.tan((26 * Math.PI) / 360)) * 1.02);
  renderer.render(scene, camera);
  return renderer.domElement;
}

const OBJECTS = {
  mascot: [mascot, LARGE],
  rocket: [rocket, LARGE],
  lens: [lens, LARGE],
  bell: [bell, LARGE],
  bot: [bot, LARGE],
  cloud: [cloud, SMALL],
  'tile-orange': [tile('orange', targetEmblem), SMALL],
  'tile-blue': [tile('blue', bellEmblem), SMALL],
  'tile-yellow': [tile('cream', flaskEmblem), SMALL],
  'tile-lilac': [tile('lilac', clipboardEmblem), SMALL],
  'tile-chart': [tile('sky', chartEmblem), SMALL],
  'tile-chat': [tile('teal', chatEmblem), SMALL],
  'tile-doc': [tile('rose', docEmblem), SMALL],
  'tile-dots': [tile('white', dotsEmblem), SMALL],
};

const out = document.getElementById('out');
const results = {};

for (const [name, [build, size]] of Object.entries(OBJECTS)) {
  const canvas = render(build, size);
  out.append(canvas);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
  const response = await fetch(`/save/${name}.webp`, { method: 'POST', body: blob });
  results[name] = [response.status, blob.size];
}

window.renderResults = results;
document.title = 'done';
