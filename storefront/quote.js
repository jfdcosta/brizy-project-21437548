import * as THREE from 'three';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { inspectGeometry } from './mesh-quote.js';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/700.css';
import '@fontsource/space-grotesk/400.css';
import '@fontsource/space-grotesk/600.css';
import '@fontsource/space-grotesk/700.css';

const input = document.querySelector('#stl-file');
const zone = document.querySelector('#stl-drop-zone');
const status = document.querySelector('#stl-status');
const stage = document.querySelector('#stl-stage');
const canvas = document.querySelector('#stl-canvas');
const colour = document.querySelector('#stl-colour');
try {
  const items = JSON.parse(localStorage.getItem('form-lab-cart-v1')) || [];
  document.querySelector('[data-cart-count]').textContent = items.reduce((sum, item) => sum + item.quantity, 0);
} catch { /* A malformed local cart should not prevent the STL preview. */ }
let renderer;
let scene;
let camera;
let mesh;
let orbiting = false;
let lastPointer = [0, 0];

function clearPreview() {
  for (const id of ['stl-name', 'stl-dimensions', 'stl-volume', 'stl-triangles']) {
    document.getElementById(id).textContent = '—';
  }
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    mesh = null;
  }
  stage.classList.remove('has-model');
}

function setupViewer() {
  if (renderer) return true;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch { stage.textContent = '3D preview is unavailable in this browser. Model measurements are shown below.'; return false; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, .1, 100);
  camera.position.set(0, 1, 5);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight('#ffffff', 2));
  const light = new THREE.DirectionalLight('#fff4df', 3);
  light.position.set(3, 5, 5);
  scene.add(light);
  const rim = new THREE.DirectionalLight('#c0e1cc', 1.7);
  rim.position.set(-3, 2, -4);
  scene.add(rim);
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  let previous = 0;
  const animate = (time) => {
    if (mesh && !orbiting) mesh.rotation.y += Math.min(time - previous || 0, 100) * .00018;
    previous = time;
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  };
  requestAnimationFrame(animate);
  canvas.addEventListener('pointerdown', (event) => {
    orbiting = true;
    lastPointer = [event.clientX, event.clientY];
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!orbiting || !mesh) return;
    mesh.rotation.y += (event.clientX - lastPointer[0]) * .008;
    mesh.rotation.x = Math.max(-.8, Math.min(.8, mesh.rotation.x + (event.clientY - lastPointer[1]) * .006));
    lastPointer = [event.clientX, event.clientY];
  });
  canvas.addEventListener('pointerup', () => { orbiting = false; });
  canvas.addEventListener('pointercancel', () => { orbiting = false; });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    camera.position.z = Math.max(3, Math.min(9, camera.position.z + event.deltaY * .004));
  }, { passive: false });
  return true;
}

function showModel(geometry, dimensionsMm) {
  if (!setupViewer()) return;
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  geometry.center();
  mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({
    color: colour.value, metalness: .08, roughness: .55, side: THREE.DoubleSide,
  }));
  mesh.scale.setScalar(2.4 / Math.max(...dimensionsMm));
  mesh.rotation.set(-.15, .3, 0);
  scene.add(mesh);
  stage.classList.add('has-model');
}

async function loadFile(file) {
  clearPreview();
  status.textContent = '';
  if (!file || !/\.stl$/i.test(file.name)) {
    status.textContent = 'Choose an STL file.';
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    status.textContent = 'This preview accepts STL files up to 20 MB.';
    return;
  }
  let geometry;
  try {
    geometry = new STLLoader().parse(await file.arrayBuffer());
    const result = inspectGeometry(geometry);
    document.querySelector('#stl-name').textContent = file.name;
    document.querySelector('#stl-dimensions').textContent = result.dimensionsMm.map((n) => n.toFixed(1)).join(' × ') + ' mm';
    document.querySelector('#stl-volume').textContent = result.volumeCm3.toFixed(2) + ' cm³';
    document.querySelector('#stl-triangles').textContent = result.triangles.toLocaleString('en-GB');
    showModel(geometry, result.dimensionsMm);
    status.textContent = 'Preview ready. Confirm the dimensions are in millimetres.';
  } catch (error) {
    geometry?.dispose();
    status.textContent = error.message || 'The STL could not be read.';
  }
}

input.addEventListener('change', () => loadFile(input.files[0]));
zone.addEventListener('dragover', (event) => { event.preventDefault(); zone.classList.add('dragging'); });
zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
zone.addEventListener('drop', (event) => {
  event.preventDefault();
  zone.classList.remove('dragging');
  loadFile(event.dataTransfer.files[0]);
});
colour.addEventListener('change', () => { if (mesh) mesh.material.color.set(colour.value); });
