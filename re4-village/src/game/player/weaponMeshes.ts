import * as THREE from 'three';
import { merge, place, tint } from '../../render/geo';

/** Low-poly weapon models. Origin at the grip, barrel along -Z. */
const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

function box(w: number, h: number, d: number, x: number, y: number, z: number, color: number, rx = 0) {
  return tint(place(new THREE.BoxGeometry(w, h, d), x, y, z, rx), color);
}
function cyl(r: number, len: number, x: number, y: number, z: number, color: number) {
  return tint(place(new THREE.CylinderGeometry(r, r, len, 6), x, y, z, Math.PI / 2), color);
}

export interface WeaponModel {
  obj: THREE.Object3D;
  muzzle: THREE.Vector3; // local
  length: number;
}

export function makeWeaponModel(id: string): WeaponModel {
  const g: THREE.BufferGeometry[] = [];
  let muzzle = new THREE.Vector3(0, 0.07, -0.2);
  const dark = 0x2a2c30, darker = 0x1a1a1c, wood = 0x6a4428, steel = 0x55585c;
  switch (id) {
    case 'sg09':
      g.push(box(0.035, 0.1, 0.05, 0, -0.02, 0.01, darker, -0.25)); // grip
      g.push(box(0.04, 0.045, 0.2, 0, 0.055, -0.06, dark)); // slide
      g.push(box(0.03, 0.02, 0.05, 0, 0.02, -0.02, darker)); // trigger guard
      muzzle = new THREE.Vector3(0, 0.055, -0.17);
      break;
    case 'red9':
      g.push(box(0.035, 0.1, 0.05, 0, -0.02, 0.01, wood, -0.2));
      g.push(box(0.05, 0.08, 0.1, 0, 0.05, -0.04, darker)); // magazine well (front mag)
      g.push(cyl(0.013, 0.22, 0, 0.07, -0.19, steel));
      g.push(box(0.04, 0.05, 0.12, 0, 0.07, -0.02, dark));
      muzzle = new THREE.Vector3(0, 0.07, -0.3);
      break;
    case 'w870':
      g.push(box(0.04, 0.09, 0.07, 0, -0.03, 0.02, darker, -0.3)); // pistol grip area
      g.push(box(0.05, 0.07, 0.3, 0, 0.03, 0.2, wood)); // stock
      g.push(box(0.05, 0.06, 0.22, 0, 0.04, -0.08, dark)); // receiver
      g.push(cyl(0.016, 0.52, 0, 0.06, -0.44, steel)); // barrel
      g.push(cyl(0.02, 0.2, 0, 0.025, -0.34, wood)); // pump
      g.push(cyl(0.012, 0.36, 0, 0.03, -0.38, darker)); // tube
      muzzle = new THREE.Vector3(0, 0.06, -0.7);
      break;
    case 'sr1903':
      g.push(box(0.045, 0.08, 0.5, 0, 0.01, 0.05, wood)); // stock+body
      g.push(box(0.04, 0.05, 0.36, 0, 0.02, -0.34, wood)); // forestock
      g.push(cyl(0.012, 0.62, 0, 0.055, -0.52, steel)); // barrel
      g.push(cyl(0.024, 0.28, 0, 0.12, -0.06, darker)); // scope
      g.push(box(0.02, 0.04, 0.02, 0.035, 0.06, 0.05, steel)); // bolt
      muzzle = new THREE.Vector3(0, 0.055, -0.84);
      break;
    case 'knife':
      g.push(box(0.03, 0.03, 0.11, 0, 0, 0.03, darker)); // handle
      g.push(box(0.008, 0.035, 0.17, 0, 0.005, -0.1, 0xb8bcc0)); // blade
      muzzle = new THREE.Vector3(0, 0, -0.18);
      break;
    case 'nade':
      g.push(tint(new THREE.IcosahedronGeometry(0.045, 0), 0x3a4a2a));
      g.push(box(0.02, 0.03, 0.02, 0, 0.05, 0, steel));
      break;
    case 'flash':
      g.push(tint(place(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 6), 0, 0, 0), 0x707070));
      break;
  }
  const mesh = new THREE.Mesh(merge(g), mat);
  mesh.castShadow = true;
  const obj = new THREE.Object3D();
  obj.add(mesh);
  return { obj, muzzle, length: -muzzle.z };
}

/** Enemy melee weapons. Origin at the hand; tool extends along -Z (then tilted by attach). */
export function makeEnemyWeapon(kind: string): THREE.Object3D {
  const g: THREE.BufferGeometry[] = [];
  const wood = 0x6a5030, metal = 0x6a6a68, rust = 0x5a3a2a;
  switch (kind) {
    case 'sickle':
      g.push(tint(place(new THREE.CylinderGeometry(0.018, 0.02, 0.32, 5), 0, 0, -0.1, Math.PI / 2), wood));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 0.9;
        g.push(box(0.012, 0.035, 0.06, 0, Math.sin(a) * 0.14, -0.26 - Math.cos(a) * 0.1 + 0.1, metal, -a));
      }
      break;
    case 'axe':
    case 'hatchet':
      g.push(tint(place(new THREE.CylinderGeometry(0.02, 0.024, kind === 'axe' ? 0.7 : 0.42, 5), 0, 0, kind === 'axe' ? -0.25 : -0.12, Math.PI / 2), wood));
      g.push(box(0.03, 0.16, 0.12, 0, 0.06, kind === 'axe' ? -0.56 : -0.3, rust));
      break;
    case 'pitchfork':
      g.push(tint(place(new THREE.CylinderGeometry(0.022, 0.022, 1.7, 5), 0, 0, -0.35, Math.PI / 2), wood));
      g.push(box(0.26, 0.03, 0.03, 0, 0, -1.2, metal));
      for (const x of [-0.12, -0.04, 0.04, 0.12]) g.push(box(0.02, 0.02, 0.3, x, 0, -1.35, metal));
      break;
    case 'torch':
      g.push(tint(place(new THREE.CylinderGeometry(0.025, 0.03, 0.6, 5), 0, 0, -0.2, Math.PI / 2), wood));
      g.push(box(0.09, 0.09, 0.14, 0, 0, -0.52, 0x3a2a1a));
      break;
    case 'dynamite':
      g.push(tint(place(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), 0, 0, -0.05, Math.PI / 2), 0xa02a1a));
      g.push(box(0.005, 0.005, 0.06, 0, 0, -0.17, 0x222222));
      break;
    case 'chainsaw':
      g.push(box(0.2, 0.22, 0.36, 0, 0.02, 0.05, 0x8a2a1a)); // engine
      g.push(box(0.2, 0.05, 0.1, 0, 0.16, 0.05, 0x333333)); // handle top
      g.push(box(0.04, 0.12, 0.8, 0, 0, -0.5, 0x8a8a88)); // bar
      g.push(box(0.05, 0.02, 0.82, 0, 0.07, -0.5, 0x3a3a3a)); // chain top
      g.push(box(0.05, 0.02, 0.82, 0, -0.07, -0.5, 0x3a3a3a));
      break;
  }
  const mesh = new THREE.Mesh(merge(g), mat);
  mesh.castShadow = true;
  const obj = new THREE.Object3D();
  obj.add(mesh);
  return obj;
}
