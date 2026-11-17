import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RotateCcw } from 'lucide-react';

interface ReportCategory {
  label: string;
  current: number;
  prior: number;
  note: string;
}

interface Analytics3DChartProps {
  title: string;
  unit: string;
  categories: ReportCategory[];
  selectedIdx: number;
  onSelectIdx: (idx: number) => void;
}

export const Analytics3DChart: React.FC<Analytics3DChartProps> = ({
  title,
  unit,
  categories,
  selectedIdx,
  onSelectIdx,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const categoriesRef = useRef(categories);
  const selectedIdxRef = useRef(selectedIdx);
  const onSelectRef = useRef(onSelectIdx);
  const rebuildRef = useRef<(() => void) | null>(null);
  const resetCamRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    categoriesRef.current = categories;
    rebuildRef.current?.();
  }, [categories]);

  useEffect(() => {
    selectedIdxRef.current = selectedIdx;
  }, [selectedIdx]);

  useEffect(() => {
    onSelectRef.current = onSelectIdx;
  }, [onSelectIdx]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const probe = document.createElement('canvas').getContext('webgl2');
      if (!probe) return true;
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(container.clientWidth || 560, container.clientHeight || 320);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    scene.fog = new THREE.Fog(0xf8fafc, 16, 36);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(
      40,
      (container.clientWidth || 560) / (container.clientHeight || 320),
      0.1,
      80
    );
    const initialPos = new THREE.Vector3(7.6, 5.8, 8.2);
    const initialTarget = new THREE.Vector3(0, 1.3, 0);
    camera.position.copy(initialPos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 5;
    controls.maxDistance = 18;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.target.copy(initialTarget);

    resetCamRef.current = () => {
      camera.position.copy(initialPos);
      controls.target.copy(initialTarget);
      controls.update();
    };

    const hemi = new THREE.HemisphereLight(0xffffff, 0xcbd5e1, 0.82);
    scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff7ed, 1.3);
    key.position.set(8, 14, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -8;
    key.shadow.camera.right = 8;
    key.shadow.camera.top = 8;
    key.shadow.camera.bottom = -8;
    key.shadow.bias = -0.0005;
    scene.add(key);

    // Base plinth + subtle grid
    const plinthGeo = new THREE.BoxGeometry(10.5, 0.24, 5.2);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.75,
      metalness: 0.05,
    });
    const plinth = new THREE.Mesh(plinthGeo, plinthMat);
    plinth.position.y = -0.12;
    plinth.receiveShadow = true;
    scene.add(plinth);

    const grid = new THREE.GridHelper(10.5, 14, 0xcbd5e1, 0xe2e8f0);
    grid.position.y = 0.01;
    scene.add(grid);

    const barsGroup = new THREE.Group();
    scene.add(barsGroup);

    const dynamicGeos: THREE.BufferGeometry[] = [];
    const dynamicMats: THREE.Material[] = [];
    let currentBars: { mesh: THREE.Mesh; targetH: number; idx: number; isCurrent: boolean }[] = [];
    let hitProxies: THREE.Mesh[] = [];

    const buildBars = () => {
      while (barsGroup.children.length > 0) {
        barsGroup.remove(barsGroup.children[0]);
      }
      dynamicGeos.forEach((g) => g.dispose());
      dynamicMats.forEach((m) => m.dispose());
      dynamicGeos.length = 0;
      dynamicMats.length = 0;
      currentBars = [];
      hitProxies = [];

      const cats = categoriesRef.current;
      const maxVal = Math.max(...cats.flatMap((c) => [c.current, c.prior]), 1);
      const spacing = 2.2;
      const startX = -((cats.length - 1) * spacing) / 2;

      cats.forEach((cat, idx) => {
        const x = startX + idx * spacing;
        const hCurr = Math.max((cat.current / maxVal) * 3.8, 0.25);
        const hPrior = Math.max((cat.prior / maxVal) * 3.8, 0.25);

        // Current period pillar (Emerald)
        const currGeo = new THREE.BoxGeometry(0.66, 1, 0.66);
        const currMat = new THREE.MeshStandardMaterial({
          color: 0x059669,
          roughness: 0.28,
          metalness: 0.15,
        });
        dynamicGeos.push(currGeo);
        dynamicMats.push(currMat);
        const currMesh = new THREE.Mesh(currGeo, currMat);
        currMesh.position.set(x, 0.02, 0.55);
        currMesh.scale.y = 0.05;
        currMesh.castShadow = true;
        currMesh.receiveShadow = true;
        barsGroup.add(currMesh);
        currentBars.push({ mesh: currMesh, targetH: hCurr, idx, isCurrent: true });

        // Prior period pillar (Cobalt)
        const priorGeo = new THREE.BoxGeometry(0.66, 1, 0.66);
        const priorMat = new THREE.MeshStandardMaterial({
          color: 0x2563eb,
          roughness: 0.32,
          metalness: 0.12,
        });
        dynamicGeos.push(priorGeo);
        dynamicMats.push(priorMat);
        const priorMesh = new THREE.Mesh(priorGeo, priorMat);
        priorMesh.position.set(x, 0.02, -0.55);
        priorMesh.scale.y = 0.05;
        priorMesh.castShadow = true;
        priorMesh.receiveShadow = true;
        barsGroup.add(priorMesh);
        currentBars.push({ mesh: priorMesh, targetH: hPrior, idx, isCurrent: false });

        // Selection pad underneath
        const padGeo = new THREE.BoxGeometry(1.5, 0.04, 2.3);
        const padMat = new THREE.MeshStandardMaterial({
          color: 0x84cc16,
          roughness: 0.4,
          transparent: true,
          opacity: 0,
        });
        dynamicGeos.push(padGeo);
        dynamicMats.push(padMat);
        const pad = new THREE.Mesh(padGeo, padMat);
        pad.position.set(x, 0.02, 0);
        pad.userData.padIdx = idx;
        barsGroup.add(pad);

        // Hit proxy on layer 1
        const proxyGeo = new THREE.BoxGeometry(1.6, 4.2, 2.5);
        const proxyMat = new THREE.MeshBasicMaterial({ visible: false });
        dynamicGeos.push(proxyGeo);
        dynamicMats.push(proxyMat);
        const proxy = new THREE.Mesh(proxyGeo, proxyMat);
        proxy.position.set(x, 2.1, 0);
        proxy.layers.set(1);
        proxy.userData.catIdx = idx;
        barsGroup.add(proxy);
        hitProxies.push(proxy);
      });
    };

    buildBars();
    rebuildRef.current = buildBars;

    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };

    const updatePtr = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
      updatePtr(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        onSelectRef.current(hits[0].object.userData.catIdx as number);
      }
    };

    const onMove = (e: PointerEvent) => {
      updatePtr(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        setHoveredIdx(hits[0].object.userData.catIdx as number);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredIdx(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);

    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || 560;
      const h = container.clientHeight || 320;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) {
          if (sync) gl.deleteSync(sync);
          return;
        }
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      const delta = Math.min(clock.getDelta(), 0.1);
      const sel = selectedIdxRef.current;

      for (let i = 0; i < currentBars.length; i++) {
        const b = currentBars[i];
        b.mesh.scale.y = THREE.MathUtils.damp(b.mesh.scale.y, b.targetH, 8, delta);
        b.mesh.position.y = b.mesh.scale.y / 2 + 0.02;
        const mat = b.mesh.material as THREE.MeshStandardMaterial;
        if (b.idx === sel) {
          mat.emissive.setHex(b.isCurrent ? 0x059669 : 0x2563eb);
          mat.emissiveIntensity = 0.25;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }

      barsGroup.children.forEach((child) => {
        if (child.userData.padIdx !== undefined) {
          const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
          mat.opacity = child.userData.padIdx === sel ? 0.55 : 0;
        }
      });

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      controls.dispose();
      dynamicGeos.forEach((g) => g.dispose());
      dynamicMats.forEach((m) => m.dispose());
      plinthGeo.dispose();
      plinthMat.dispose();
      envTex.dispose();
      renderer.dispose();
    };
  }, []);

  const displayIdx = hoveredIdx !== null ? hoveredIdx : selectedIdx;
  const activeCat = categories[displayIdx] ?? categories[0];

  return (
    <div className="relative h-[340px] w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
      <div ref={mountRef} className="w-full h-full" />

      {/* Top-left Legend */}
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-3 rounded-full border border-[#E2E8F0] bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-[#334155] shadow-xs">
        <span className="font-display text-[#0F172A]">{title} (3D)</span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#059669]" />
          Current
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
          Prior
        </span>
      </div>

      {/* Reset Camera */}
      <button
        type="button"
        onClick={() => resetCamRef.current?.()}
        title="Reset 3D camera"
        aria-label="Reset 3D graph camera"
        className="absolute top-3 right-3 z-10 rounded-full border border-[#E2E8F0] bg-white/95 p-1.5 text-[#64748B] hover:text-[#0F172A] shadow-xs cursor-pointer"
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>

      {/* Bottom Interactive Inspection Dock */}
      {activeCat && (
        <div className="absolute bottom-3 left-3 right-3 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2E8F0] bg-white/95 px-4 py-2.5 shadow-sm">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs font-bold text-[#0F172A] whitespace-nowrap">
              {activeCat.label}
            </span>
            <span className="text-xs text-[#64748B] truncate hidden sm:inline">
              {activeCat.note}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
            <span className="font-semibold text-[#059669]">
              Now: {activeCat.current} {unit}
            </span>
            <span className="text-[#2563EB]">
              Prior: {activeCat.prior} {unit}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
