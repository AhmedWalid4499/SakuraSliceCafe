// The film on the TV itself: the YouTube player is put in the world with
// three.js's CSS3DRenderer, lined up exactly with a screen in the room, on a
// layer just behind the 3D picture — and that screen becomes a hole (it draws
// nothing, see-through), so you see the film through it. Anyone who walks in
// front of the screen still hides it, the way they would a real TV.
//
//   const tv = createScreenLayer({ canvas, camera });
//   tv.attach(screenMesh, mediaElement)  // the film plays on that screen
//   tv.detach(homeForMedia)              // and back where it came from
//   tv.render() each frame, tv.setSize(w, h) on resize

import * as THREE from 'three';
import { CSS3DRenderer, CSS3DObject } from 'three/addons/renderers/CSS3DRenderer.js';

const PX = 1280; // how many CSS pixels wide the player is, before it's scaled to the screen

export function createScreenLayer({ canvas, camera }) {
  const css = new CSS3DRenderer();
  const el = css.domElement;
  el.id = 'screenLayer';
  Object.assign(el.style, { position: 'fixed', inset: '0', pointerEvents: 'none', background: '#000' });
  canvas.parentNode.insertBefore(el, canvas); // behind the 3D picture (it comes first)
  el.style.display = 'none';
  const scene = new THREE.Scene();
  const box = document.createElement('div');
  Object.assign(box.style, { width: PX + 'px', height: Math.round(PX * 9 / 16) + 'px', background: '#000', overflow: 'hidden', position: 'relative' });
  const obj = new CSS3DObject(box);
  scene.add(obj);
  let mesh = null, saved = null, media = null, home = null;
  const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();

  function attach(m, mediaEl) {
    if (mesh === m && media === mediaEl) return true;
    detach();
    if (!m || !m.geometry || !m.geometry.parameters) return false;
    const { width = 1, height = 1 } = m.geometry.parameters;
    box.style.height = Math.round(PX * height / width) + 'px';
    mesh = m; saved = m.material;
    // the hole: writes nothing but "see-through", so the layer behind shows
    m.material = new THREE.MeshBasicMaterial({ color: '#000000', opacity: 0, blending: THREE.NoBlending, side: THREE.DoubleSide });
    media = mediaEl; home = mediaEl.parentNode;
    box.appendChild(mediaEl);
    el.style.display = '';
    render(); // (the player only joins the page once the layer has drawn it)
    return true;
  }
  function detach() {
    if (mesh) { mesh.material.dispose(); mesh.material = saved; }
    if (media && home) home.appendChild(media);
    mesh = saved = media = home = null;
    el.style.display = 'none';
  }
  function render() {
    if (!mesh) return;
    mesh.updateWorldMatrix(true, false);
    mesh.matrixWorld.decompose(pos, quat, scl);
    const { width = 1 } = mesh.geometry.parameters;
    obj.position.copy(pos);
    obj.quaternion.copy(quat);
    obj.scale.copy(scl).multiplyScalar(width / PX);
    // hidden (another floor) — hide the film too
    let shown = true;
    for (let o = mesh; o; o = o.parent) if (!o.visible) { shown = false; break; }
    box.style.visibility = shown ? 'visible' : 'hidden';
    css.render(scene, camera);
  }
  return {
    attach, detach, render,
    get active() { return !!mesh; },
    setSize(w, h) { css.setSize(w, h); },
  };
}
