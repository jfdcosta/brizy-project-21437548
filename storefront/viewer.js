import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const element = (tag, className, value) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = value;
  return node;
};

function makeModel(product) {
  const group = new THREE.Group();
  const color = new THREE.Color(product.accent || '#6d8a53');
  const material = new THREE.MeshStandardMaterial({ color, metalness: .13, roughness: .57 });
  const detail = new THREE.MeshStandardMaterial({ color: '#d7ddc8', metalness: .35, roughness: .32 });
  const dark = new THREE.MeshStandardMaterial({ color: '#29312b', metalness: .2, roughness: .4 });
  const add = (geometry, mat, position = [0, 0, 0], rotation = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(...position);
    mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  if (product.model === 'bottle') {
    add(new THREE.CylinderGeometry(.67, .75, 2.25, 48), material, [0, 0, 0]);
    add(new THREE.CylinderGeometry(.42, .45, .48, 48), detail, [0, 1.36, 0]);
    add(new THREE.CylinderGeometry(.44, .44, .18, 48), dark, [0, 1.68, 0]);
    add(new THREE.TorusGeometry(.7, .04, 12, 48), dark, [0, -.93, 0], [Math.PI / 2, 0, 0]);
    add(new THREE.BoxGeometry(.68, .15, .035), detail, [0, .15, .67]);
  } else if (product.model === 'desk') {
    add(new THREE.BoxGeometry(2.35, .23, 1.55), material, [0, -.6, 0]);
    add(new THREE.BoxGeometry(.16, .7, 1.42), material, [-1.08, -.13, 0]);
    add(new THREE.BoxGeometry(.16, .7, 1.42), material, [1.08, -.13, 0]);
    add(new THREE.BoxGeometry(2.05, .7, .16), material, [0, -.13, -.65]);
    add(new THREE.BoxGeometry(.1, .66, 1.3), detail, [.25, -.11, 0]);
    add(new THREE.CylinderGeometry(.35, .35, .15, 32), dark, [-.45, -.38, .05]);
  } else {
    const points = [];
    for (let index = 0; index <= 96; index++) {
      const theta = (index / 96) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * 1.25, Math.sin(theta) * .76, Math.sin(theta) * .15));
    }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 120, .22, 12, true), material);
    add(new THREE.BoxGeometry(.42, .47, .5), dark, [0, -.79, 0]);
    add(new THREE.BoxGeometry(.27, .35, .53), detail, [0, -.79, .03]);
  }
  return group;
}

const modelCache = new Map();
async function loadDisplayModel(product) {
  if (!modelCache.has(product.model3d)) modelCache.set(product.model3d, new GLTFLoader().loadAsync(product.model3d));
  const gltf = await modelCache.get(product.model3d);
  const actualParts = gltf.scene.clone(true);
  actualParts.traverse((part) => {
    if (part.isMesh) { part.castShadow = true; part.receiveShadow = true; }
  });
  const bounds = new THREE.Box3().setFromObject(actualParts);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());
  actualParts.position.sub(center);
  const wrapper = new THREE.Group();
  wrapper.add(actualParts);
  wrapper.scale.setScalar(3.3 / Math.max(size.x, size.y, size.z));
  wrapper.rotation.y = Math.PI + 0.35;
  return wrapper;
}

function viewerControls(parent, name, { rotate, zoom, reset }) {
  const controls = element('div', 'viewer-controls');
  const actions = [
    ['←', `Rotate ${name} left`, () => rotate(-1)],
    ['→', `Rotate ${name} right`, () => rotate(1)],
    ['−', 'Zoom out', () => zoom(-1)],
    ['+', 'Zoom in', () => zoom(1)],
    ['Reset', 'Reset view', reset],
  ];
  for (const [label, accessibleLabel, action] of actions) {
    const button = element('button', '', label);
    button.type = 'button';
    button.setAttribute('aria-label', accessibleLabel);
    button.title = accessibleLabel;
    button.addEventListener('click', action);
    controls.append(button);
  }
  parent.append(controls);
  return controls;
}

let webglAvailable = true;

function createTurntable(canvas, product, interactive) {
  const image = element('img', 'turntable-image');
  image.draggable = false;
  image.tabIndex = interactive ? 0 : -1;
  canvas.replaceWith(image);
  let current = product;
  let frame = 0;
  let zoom = 1;
  let dragging = false;
  let lastX = 0;
  const frameUrl = (item, index) => `${item.turntable.base}/${String(index).padStart(2, '0')}.webp`;
  const showFrame = () => {
    image.src = current.turntable ? frameUrl(current, frame) : current.image || '';
    image.dataset.frame = String(frame);
  };
  const setProduct = (next) => {
    current = next;
    frame = 0;
    image.alt = next.turntable ? `Interactive 360 degree view of ${next.name}` : `Photograph of ${next.name}`;
    image.dataset.modelSource = next.turntable ? 'turntable' : 'photo';
    image.dataset.modelStatus = 'ready';
    showFrame();
    if (next.turntable) {
      for (let index = 1; index < next.turntable.frames; index++) {
        const preload = new Image();
        preload.src = frameUrl(next, index);
      }
    }
  };
  const advance = (steps) => {
    if (!current.turntable) return;
    frame = (frame + steps % current.turntable.frames + current.turntable.frames) % current.turntable.frames;
    showFrame();
  };
  if (interactive) {
    const updateZoom = (steps) => {
      zoom = Math.max(1, Math.min(1.8, zoom + steps * .15));
      image.style.transform = `scale(${zoom})`;
    };
    viewerControls(image.parentElement, product.name, {
      rotate: advance,
      zoom: updateZoom,
      reset() { frame = 0; zoom = 1; image.style.transform = ''; showFrame(); },
    });
    image.addEventListener('pointerdown', (event) => {
      if (dragging) return;
      dragging = true;
      lastX = event.clientX;
      image.setPointerCapture(event.pointerId);
    });
    image.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      const steps = Math.trunc((event.clientX - lastX) / 16);
      if (!steps) return;
      advance(steps);
      lastX += steps * 16;
    });
    image.addEventListener('pointerup', () => { dragging = false; });
    image.addEventListener('pointercancel', () => { dragging = false; });
    image.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { advance(-1); event.preventDefault(); }
      if (event.key === 'ArrowRight') { advance(1); event.preventDefault(); }
    });
    image.addEventListener('wheel', (event) => {
      event.preventDefault();
      zoom = Math.max(1, Math.min(1.8, zoom - event.deltaY * .001));
      image.style.transform = `scale(${zoom})`;
    }, { passive: false });
  }
  setProduct(product);
  return { setProduct, setActive() {} };
}

export function createViewer(canvas, product, interactive = false) {
  if (!webglAvailable && product.turntable) return createTurntable(canvas, product, interactive);
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true }); }
  catch {
    webglAvailable = false;
    if (product.turntable) return createTurntable(canvas, product, interactive);
    if (product.image) {
      const photo = element('img', 'viewer-fallback-photo');
      photo.src = product.image;
      photo.alt = `Photograph of ${product.name}`;
      canvas.replaceWith(photo);
    } else canvas.replaceWith(element('div', 'viewer-fallback', product.name));
    return { setProduct() {}, setActive() {} };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, .1, 100);
  camera.position.set(0, 1.15, 6.4);
  camera.lookAt(0, 0, 0);
  scene.add(new THREE.AmbientLight('#ffffff', 2.1));
  const light = new THREE.DirectionalLight('#fff5e6', 3.2);
  light.position.set(3, 5, 5);
  light.castShadow = true;
  scene.add(light);
  const rim = new THREE.DirectionalLight('#c9e4dc', 2.0);
  rim.position.set(-4, 2, -4);
  scene.add(rim);
  let model = new THREE.Group();
  scene.add(model);
  let loadVersion = 0;
  let active = true;
  const render = () => { if (active) renderer.render(scene, camera); };
  const setProduct = (next) => {
    const version = ++loadVersion;
    canvas.parentElement.querySelector('.viewer-fallback-photo')?.remove();
    canvas.setAttribute('aria-busy', next.model3d ? 'true' : 'false');
    canvas.dataset.modelStatus = next.model3d ? 'loading' : 'ready';
    const apply = (nextModel) => {
      if (version !== loadVersion) return;
      scene.remove(model);
      model = nextModel;
      scene.add(model);
      canvas.dataset.modelStatus = 'ready';
      canvas.dataset.modelSource = next.model3d ? 'actual' : 'concept';
      canvas.setAttribute('aria-busy', 'false');
      render();
    };
    if (!next.model3d) { apply(makeModel(next)); return; }
    loadDisplayModel(next).then(apply).catch((error) => {
      if (version !== loadVersion) return;
      console.error('3D model could not load', error);
      canvas.dataset.modelStatus = 'error';
      canvas.setAttribute('aria-busy', 'false');
      if (next.image) {
        const photo = element('img', 'viewer-fallback-photo');
        photo.src = next.image;
        photo.alt = `Photograph of ${next.name}`;
        canvas.parentElement.append(photo);
      }
    });
  };
  let dragging = false, lastX = 0, lastY = 0;
  if (interactive) {
    canvas.tabIndex = 0;
    const rotate = (steps) => { model.rotation.y += steps * Math.PI / 12; render(); };
    const zoom = (steps) => { camera.position.z = Math.max(4.2, Math.min(8.4, camera.position.z - steps * .5)); render(); };
    viewerControls(canvas.parentElement, product.name, { rotate, zoom, reset() { model.rotation.set(0, product.model3d ? Math.PI + .35 : 0, 0); camera.position.z = 6.4; render(); } });
    canvas.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') { rotate(-1); event.preventDefault(); }
      if (event.key === 'ArrowRight') { rotate(1); event.preventDefault(); }
    });
    canvas.addEventListener('pointerdown', (event) => { if (dragging) return; dragging = true; lastX = event.clientX; lastY = event.clientY; canvas.setPointerCapture(event.pointerId); });
    canvas.addEventListener('pointermove', (event) => {
      if (!dragging) return;
      model.rotation.y += (event.clientX - lastX) * .008;
      model.rotation.x = Math.max(-.6, Math.min(.6, model.rotation.x + (event.clientY - lastY) * .006));
      lastX = event.clientX; lastY = event.clientY;
      render();
    });
    canvas.addEventListener('pointerup', () => { dragging = false; });
    canvas.addEventListener('pointercancel', () => { dragging = false; });
    canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      camera.position.z = Math.max(4.2, Math.min(8.4, camera.position.z + event.deltaY * .004));
      render();
    }, { passive: false });
  }
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    render();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  setProduct(product);
  return {
    setProduct,
    setActive(value) { active = value; if (active) resize(); },
    setYaw(yaw) { model.rotation.y = yaw; },
    capture() { renderer.render(scene, camera); return canvas.toDataURL('image/webp', .8); },
  };
}

