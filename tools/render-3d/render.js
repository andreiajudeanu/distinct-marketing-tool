import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const SIZE = 840;
const COLORS = {
  violet: '#7a55f5', lilac: '#b49bff', aqua: '#4fe6d6', teal: '#24c6c0', pink: '#f62a66', rose: '#f696fc',
  orange: '#fca842', yellow: '#ffd64d', lime: '#c6d806', white: '#fbfbfb', ink: '#17151f',
};

const clay = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
  color: COLORS[color] ?? color, roughness: 0.36, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22,
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

function bag() {
  const group = new THREE.Group();
  group.add(mesh(new RoundedBoxGeometry(2.1, 2.2, 1.15, 12, 0.3), clay('orange')));
  group.add(mesh(new RoundedBoxGeometry(2.14, 0.3, 1.19, 8, 0.12), clay('pink'), [0, 0.72, 0]));
  const handle = new THREE.TorusGeometry(0.62, 0.11, 24, 80, Math.PI);
  group.add(mesh(handle, clay('violet'), [0, 1.08, 0.3]));
  group.add(mesh(handle, clay('violet'), [0, 1.08, -0.3]));
  group.add(mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 64), clay('white'), [0, -0.2, 0.6], [Math.PI / 2, 0, 0]));
  const check = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, -0.2, 0.7), new THREE.Vector3(-0.05, -0.34, 0.72), new THREE.Vector3(0.22, -0.04, 0.72),
  ], false, 'catmullrom', 0.02);
  group.add(mesh(new THREE.TubeGeometry(check, 32, 0.055, 16), clay('teal')));
  group.rotation.set(0.14, -0.55, 0.14);
  return group;
}

function lens() {
  const group = new THREE.Group();
  group.add(mesh(new THREE.TorusGeometry(1.08, 0.24, 48, 128), clay('aqua')));
  group.add(mesh(new THREE.TorusGeometry(0.86, 0.05, 24, 128), clay('white')));
  group.add(mesh(new THREE.SphereGeometry(1.05, 64, 64).scale(1, 1, 0.28), glass('#bff5ff', 0.4)));
  const handle = new THREE.Group();
  handle.add(mesh(new THREE.CapsuleGeometry(0.24, 1.15, 16, 48), clay('orange'), [0, -0.9, 0]));
  handle.add(mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.4, 48), clay('pink'), [0, -0.12, 0]));
  handle.position.set(0.86, -0.86, 0);
  handle.rotation.z = Math.PI / 4;
  group.add(handle);
  group.add(mesh(new THREE.SphereGeometry(0.16, 32, 32), clay('white', { emissive: '#ffffff', emissiveIntensity: 0.6 }), [-0.42, 0.44, 0.3]));
  group.position.set(-0.3, 0.3, 0);
  group.rotation.set(0.2, -0.5, 0.05);
  return group;
}

function bell() {
  const group = new THREE.Group();
  group.add(lathe(smooth([[0, 1.42], [0.3, 1.38], [0.56, 1.1], [0.72, 0.5], [0.86, -0.1], [1.2, -0.62], [1.32, -0.82], [1.1, -0.86]]),
    clay('yellow', { side: THREE.DoubleSide })));
  group.add(mesh(new THREE.TorusGeometry(1.2, 0.1, 32, 128), clay('pink'), [0, -0.8, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.3, 48, 48), clay('pink'), [0.05, -1.06, 0.1]));
  group.add(mesh(new THREE.TorusGeometry(0.19, 0.07, 24, 64), clay('violet'), [0, 1.58, 0]));
  group.add(mesh(new THREE.CapsuleGeometry(0.09, 0.42, 12, 32), clay('white'), [-0.46, 0.5, 0.62], [0.2, 0, 0.3]));
  group.rotation.set(0.1, -0.3, -0.22);
  return group;
}

function flask() {
  const group = new THREE.Group();
  const outline = smooth([[0, -1.5], [0.8, -1.46], [1.2, -1.2], [1.12, -0.7], [0.56, 0.3], [0.36, 0.9], [0.36, 1.32]]);
  group.add(lathe(outline, glass('#e8f7ff', 0.36)));
  const liquid = smooth([[0, -1.42], [0.76, -1.38], [1.12, -1.14], [1.04, -0.68], [0.72, -0.14]]).concat([[0, -0.14]]);
  group.add(lathe(liquid, clay('aqua')));
  group.add(mesh(new THREE.CircleGeometry(0.72, 64), clay('rose'), [0, -0.13, 0], [-Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.TorusGeometry(0.42, 0.075, 24, 96), clay('white'), [0, 1.34, 0], [Math.PI / 2, 0, 0]));
  group.add(mesh(new THREE.CylinderGeometry(0.38, 0.32, 0.46, 64), clay('orange'), [0, 1.52, 0]));
  [[-0.4, -0.7, 0.72, 0.13], [0.3, -0.98, 0.76, 0.18], [0.1, -0.42, 0.56, 0.09], [0.54, 0.92, 0.3, 0.13], [-0.72, 1.3, 0.1, 0.17]]
    .forEach(([x, y, z, r], i) => group.add(mesh(new THREE.SphereGeometry(r, 32, 32), clay(i < 3 ? 'white' : 'rose'), [x, y, z])));
  group.rotation.set(0.1, -0.35, 0.18);
  return group;
}

function bot() {
  const group = new THREE.Group();
  group.add(mesh(new THREE.CapsuleGeometry(1.05, 0.5, 24, 96).rotateZ(Math.PI / 2), clay('white')));
  group.add(mesh(new THREE.CapsuleGeometry(0.72, 0.44, 24, 96).rotateZ(Math.PI / 2).scale(1, 1, 0.5), clay('ink', { roughness: 0.18 }), [0, 0.02, 0.72]));
  const eye = new THREE.CapsuleGeometry(0.17, 0.16, 16, 48);
  const glow = clay('aqua', { emissive: COLORS.aqua, emissiveIntensity: 0.9 });
  group.add(mesh(eye, glow, [-0.42, 0.04, 1.08]));
  group.add(mesh(eye, glow, [0.42, 0.04, 1.08]));
  const ear = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 64);
  group.add(mesh(ear, clay('violet'), [-1.34, 0, 0], [0, 0, Math.PI / 2]));
  group.add(mesh(ear, clay('violet'), [1.34, 0, 0], [0, 0, Math.PI / 2]));
  group.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 24), clay('violet'), [0, 1.24, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.17, 32, 32), clay('pink'), [0, 1.56, 0]));
  group.position.y = -0.12;
  group.rotation.set(0.12, -0.34, 0.1);
  return group;
}

function spark() {
  const group = new THREE.Group();
  group.add(mesh(new THREE.SphereGeometry(0.86, 64, 64), clay('rose')));
  group.add(mesh(new THREE.TorusGeometry(1.42, 0.11, 32, 128), clay('aqua'), [0, 0, 0], [1.2, 0.3, 0]));
  group.add(mesh(new THREE.SphereGeometry(0.2, 32, 32), clay('orange'), [1.32, 0.34, 0.34]));
  return group;
}

function render(build) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setSize(SIZE, SIZE, false);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 0.92;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;

  const key = new THREE.DirectionalLight('#ffffff', 1.75);
  key.position.set(-3, 5, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight('#ff7ad0', 1.6);
  rim.position.set(5, 1, -3);
  scene.add(rim);
  const fill = new THREE.DirectionalLight('#8fdcff', 0.8);
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

const OBJECTS = { bag, lens, bell, flask, bot, spark };
const out = document.getElementById('out');
const results = {};

for (const [name, build] of Object.entries(OBJECTS)) {
  const canvas = render(build);
  out.append(canvas);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
  const response = await fetch(`/save/${name}.webp`, { method: 'POST', body: blob });
  results[name] = [response.status, blob.size];
}

window.renderResults = results;
document.title = 'gata';
