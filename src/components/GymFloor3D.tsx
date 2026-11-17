import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, Eye, Layers, RotateCcw } from 'lucide-react';
import type { GymZone, ZoneId } from '../types/gym';

interface GymFloor3DProps {
  zones: GymZone[];
  selectedZone: ZoneId | 'all';
  onSelectZone: (zone: ZoneId | 'all') => void;
  totalOccupancy: number;
  maxCapacity: number;
  heightClass?: string;
}

interface CameraPreset {
  pos: [number, number, number];
  target: [number, number, number];
}

const CAMERA_PRESETS: Record<ZoneId | 'all', CameraPreset> = {
  all: { pos: [16.5, 13.5, 16.5], target: [0, 0.5, 0] },
  lifting: { pos: [-11.5, 7.2, 10.5], target: [-5.5, 1.0, -3.5] },
  cardio: { pos: [11.5, 7.2, 10.0], target: [5.5, 0.9, -3.5] },
  studio: { pos: [-10.5, 7.8, 12.0], target: [-4.8, 0.8, 4.8] },
  recovery: { pos: [11.0, 6.8, 11.5], target: [5.2, 0.9, 4.6] },
};

function createFloorTexture(
  type: 'rubber' | 'oak' | 'turf' | 'slate',
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  if (type === 'rubber') {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 2800; i++) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(5,150,105,0.08)';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.strokeStyle = 'rgba(15,23,42,0.45)';
    ctx.lineWidth = 3;
    for (let p = 0; p <= 512; p += 128) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(512, p);
      ctx.stroke();
    }
  } else if (type === 'oak') {
    ctx.fillStyle = '#d6be9c';
    ctx.fillRect(0, 0, 512, 512);
    const plankH = 32;
    for (let y = 0; y < 512; y += plankH) {
      ctx.fillStyle = (y / plankH) % 2 === 0 ? '#d8c1a0' : '#cfb48f';
      ctx.fillRect(0, y, 512, plankH - 1);
      ctx.fillStyle = 'rgba(120,85,50,0.12)';
      ctx.fillRect(0, y + plankH - 2, 512, 2);
    }
  } else if (type === 'turf') {
    ctx.fillStyle = '#047857';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 3200; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(132,204,22,0.14)' : 'rgba(6,78,59,0.22)';
      ctx.fillRect(Math.random() * 512, Math.random() * 512, 2, 3);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let x = 64; x < 512; x += 128) {
      ctx.fillRect(x, 24, 4, 464);
    }
  } else {
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 512, 512);
    ctx.strokeStyle = 'rgba(148,163,184,0.45)';
    ctx.lineWidth = 2;
    for (let p = 0; p <= 512; p += 128) {
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(512, p);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

export const GymFloor3D: React.FC<GymFloor3DProps> = ({
  zones,
  selectedZone,
  onSelectZone,
  totalOccupancy,
  maxCapacity,
  heightClass = 'aspect-[16/9] min-h-[380px] max-h-[540px]',
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [hoveredZone, setHoveredZone] = useState<ZoneId | null>(null);

  const selectedZoneRef = useRef<ZoneId | 'all'>(selectedZone);
  const showHeatmapRef = useRef<boolean>(showHeatmap);
  const zonesRef = useRef<GymZone[]>(zones);
  const onSelectZoneRef = useRef(onSelectZone);
  const cameraGoalRef = useRef<{
    pos: THREE.Vector3;
    target: THREE.Vector3;
    active: boolean;
  }>({
    pos: new THREE.Vector3(...CAMERA_PRESETS.all.pos),
    target: new THREE.Vector3(...CAMERA_PRESETS.all.target),
    active: false,
  });

  useEffect(() => {
    selectedZoneRef.current = selectedZone;
    const preset = CAMERA_PRESETS[selectedZone];
    cameraGoalRef.current.pos.set(...preset.pos);
    cameraGoalRef.current.target.set(...preset.target);
    cameraGoalRef.current.active = true;
  }, [selectedZone]);

  useEffect(() => {
    showHeatmapRef.current = showHeatmap;
  }, [showHeatmap]);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  useEffect(() => {
    onSelectZoneRef.current = onSelectZone;
  }, [onSelectZone]);

  const handleResetView = () => {
    onSelectZone('all');
    cameraGoalRef.current.pos.set(...CAMERA_PRESETS.all.pos);
    cameraGoalRef.current.target.set(...CAMERA_PRESETS.all.target);
    cameraGoalRef.current.active = true;
  };

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
    renderer.setSize(container.clientWidth || 800, container.clientHeight || 450);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';

    const handleLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const handleRestored = () => {
      setContextLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleRestored);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);
    scene.fog = new THREE.Fog(0xf1f5f9, 28, 58);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || 800) / (container.clientHeight || 450),
      0.1,
      120
    );
    camera.position.set(...CAMERA_PRESETS.all.pos);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.minDistance = 7;
    controls.maxDistance = 32;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.minPolarAngle = 0.2;
    controls.target.set(...CAMERA_PRESETS.all.target);

    controls.addEventListener('start', () => {
      cameraGoalRef.current.active = false;
    });

    // Studio Lighting Rig
    const hemi = new THREE.HemisphereLight(0xf8fafc, 0xcbd5e1, 0.78);
    hemi.position.set(0, 20, 0);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.35);
    keyLight.position.set(14, 22, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    keyLight.shadow.camera.near = 2;
    keyLight.shadow.camera.far = 55;
    keyLight.shadow.camera.left = -16;
    keyLight.shadow.camera.right = 16;
    keyLight.shadow.camera.top = 16;
    keyLight.shadow.camera.bottom = -16;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.55);
    rimLight.position.set(-14, 10, -14);
    scene.add(rimLight);

    // Materials & Textures
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const rubberTex = createFloorTexture('rubber', maxAniso);
    rubberTex.repeat.set(3, 3);
    const oakTex = createFloorTexture('oak', maxAniso);
    oakTex.repeat.set(3, 3);
    const turfTex = createFloorTexture('turf', maxAniso);
    turfTex.repeat.set(1, 2);
    const slateTex = createFloorTexture('slate', maxAniso);
    slateTex.repeat.set(3, 3);

    const geometries: THREE.BufferGeometry[] = [];
    const materials: THREE.Material[] = [];
    const textures: THREE.Texture[] = [rubberTex, oakTex, turfTex, slateTex, envTex];

    const trackGeo = <T extends THREE.BufferGeometry>(g: T): T => {
      geometries.push(g);
      return g;
    };
    const trackMat = <T extends THREE.Material>(m: T): T => {
      materials.push(m);
      return m;
    };

    // Base architectural floor plinth
    const basePlinth = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(24, 0.36, 18)),
      trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xe2e8f0,
          roughness: 0.7,
          metalness: 0.05,
        })
      )
    );
    basePlinth.position.set(0, -0.18, 0);
    basePlinth.receiveShadow = true;
    scene.add(basePlinth);

    const floorOutline = new THREE.GridHelper(48, 48, 0xcbd5e1, 0xe2e8f0);
    floorOutline.position.y = -0.35;
    scene.add(floorOutline);

    // Shared PBR materials
    const darkSteelMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.35, metalness: 0.78 })
    );
    const brushedChromeMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.18, metalness: 0.94 })
    );
    const slateFrameMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.45, metalness: 0.55 })
    );
    const leatherMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75, metalness: 0.05 })
    );
    const emeraldAccentMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x059669,
        roughness: 0.3,
        metalness: 0.1,
        emissive: 0x059669,
        emissiveIntensity: 0.15,
      })
    );
    const cobaltAccentMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2563eb,
        roughness: 0.3,
        metalness: 0.1,
        emissive: 0x2563eb,
        emissiveIntensity: 0.25,
      })
    );
    const limeBeaconMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x84cc16,
        roughness: 0.25,
        metalness: 0.1,
        emissive: 0x84cc16,
        emissiveIntensity: 0.35,
      })
    );
    const cedarWoodMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xb47b4e, roughness: 0.78, metalness: 0.02 })
    );

    // Perimeter low glass/architectural divider walls
    const backWall = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(24, 1.4, 0.18)),
      trackMat(new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55, metalness: 0.05 }))
    );
    backWall.position.set(0, 0.7, -9);
    backWall.receiveShadow = true;
    backWall.castShadow = true;
    scene.add(backWall);

    // Zone Floor Pads (offset at y = 0.02 so no Z-fighting)
    const addZonePad = (
      x: number,
      z: number,
      w: number,
      d: number,
      tex: THREE.CanvasTexture
    ) => {
      const mesh = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(w, 0.04, d)),
        trackMat(
          new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.8,
            metalness: 0.05,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
          })
        )
      );
      mesh.position.set(x, 0.02, z);
      mesh.receiveShadow = true;
      scene.add(mesh);
    };

    addZonePad(-5.6, -4.0, 10.6, 7.6, rubberTex); // Lifting
    addZonePad(5.6, -4.0, 10.6, 7.6, slateTex); // Cardio
    addZonePad(-5.6, 4.4, 10.6, 7.6, oakTex); // Studio A
    addZonePad(5.6, 4.4, 10.6, 7.6, slateTex); // Recovery

    // Sprint Turf Lane inside Studio A
    const turfMesh = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.4, 0.05, 6.8)),
      trackMat(
        new THREE.MeshStandardMaterial({
          map: turfTex,
          roughness: 0.9,
          metalness: 0.0,
        })
      )
    );
    turfMesh.position.set(-2.0, 0.035, 4.4);
    turfMesh.receiveShadow = true;
    scene.add(turfMesh);

    // Zone 1: Olympic Lifting & Strength (4 composite power racks + benches)
    const buildPowerRack = (rx: number, rz: number) => {
      const rack = new THREE.Group();
      rack.position.set(rx, 0.04, rz);

      const postGeo = trackGeo(new THREE.BoxGeometry(0.1, 2.25, 0.1));
      const postCoords: [number, number][] = [
        [-0.65, -0.6],
        [0.65, -0.6],
        [-0.65, 0.6],
        [0.65, 0.6],
      ];
      postCoords.forEach(([px, pz]) => {
        const post = new THREE.Mesh(postGeo, darkSteelMat);
        post.position.set(px, 1.125, pz);
        post.castShadow = true;
        rack.add(post);
      });

      // Top crossbars + pullup bar
      const topBar = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(1.4, 0.08, 0.08)), darkSteelMat);
      topBar.position.set(0, 2.22, -0.6);
      rack.add(topBar);

      const frontBar = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 1.35, 12)),
        brushedChromeMat
      );
      frontBar.rotation.z = Math.PI / 2;
      frontBar.position.set(0, 2.22, 0.6);
      rack.add(frontBar);

      // Side tie beams
      [-0.65, 0.65].forEach((sx) => {
        const sideBeam = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.07, 0.07, 1.25)),
          slateFrameMat
        );
        sideBeam.position.set(sx, 2.2, 0);
        rack.add(sideBeam);
      });

      // Chrome Barbell + Bumper Plates
      const barbell = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.022, 0.022, 2.2, 12)),
        brushedChromeMat
      );
      barbell.rotation.z = Math.PI / 2;
      barbell.position.set(0, 1.18, 0.45);
      barbell.castShadow = true;
      rack.add(barbell);

      const plateGeo = trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 20));
      [-0.86, 0.86].forEach((px) => {
        const outerPlate = new THREE.Mesh(plateGeo, emeraldAccentMat);
        outerPlate.rotation.z = Math.PI / 2;
        outerPlate.position.set(px, 1.18, 0.45);
        outerPlate.castShadow = true;
        rack.add(outerPlate);

        const innerPlate = new THREE.Mesh(plateGeo, darkSteelMat);
        innerPlate.rotation.z = Math.PI / 2;
        innerPlate.position.set(px * 0.88, 1.18, 0.45);
        rack.add(innerPlate);
      });

      // Weight Bench
      const benchBase = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.45, 0.14, 1.1)),
        darkSteelMat
      );
      benchBase.position.set(0, 0.15, 0.65);
      rack.add(benchBase);

      const benchPad = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.32, 0.1, 1.18)),
        leatherMat
      );
      benchPad.position.set(0, 0.38, 0.65);
      benchPad.castShadow = true;
      rack.add(benchPad);

      scene.add(rack);
    };

    [-8.6, -6.2, -3.8, -1.8].forEach((rx) => buildPowerRack(rx, -5.2));

    // Dumbbell Rack
    const dbRack = new THREE.Group();
    dbRack.position.set(-5.6, 0.04, -1.6);
    const dbStand = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(4.4, 0.72, 0.55)), slateFrameMat);
    dbStand.position.y = 0.36;
    dbStand.castShadow = true;
    dbRack.add(dbStand);
    for (let i = -3; i <= 3; i++) {
      const db = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.09, 0.09, 0.34, 12)),
        brushedChromeMat
      );
      db.rotation.x = Math.PI / 2;
      db.position.set(i * 0.52, 0.78, 0);
      dbRack.add(db);
    }
    scene.add(dbRack);

    // Zone 2: Cardio Telemetry Row (6 Treadmills + 4 Rowers)
    const treadmillScreens: THREE.Mesh[] = [];
    const buildTreadmill = (tx: number, tz: number) => {
      const tm = new THREE.Group();
      tm.position.set(tx, 0.04, tz);

      const deck = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.84, 0.16, 1.95)), darkSteelMat);
      deck.position.set(0, 0.12, 0);
      deck.castShadow = true;
      tm.add(deck);

      const belt = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.68, 0.03, 1.75)),
        leatherMat
      );
      belt.position.set(0, 0.21, 0.06);
      tm.add(belt);

      // Uprights
      [-0.38, 0.38].forEach((ux) => {
        const post = new THREE.Mesh(
          trackGeo(new THREE.BoxGeometry(0.08, 1.2, 0.1)),
          slateFrameMat
        );
        post.position.set(ux, 0.72, -0.78);
        post.rotation.x = 0.12;
        post.castShadow = true;
        tm.add(post);
      });

      // Console + glowing telemetry display
      const consoleBox = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.76, 0.42, 0.12)),
        darkSteelMat
      );
      consoleBox.position.set(0, 1.32, -0.74);
      consoleBox.rotation.x = -0.35;
      tm.add(consoleBox);

      const screen = new THREE.Mesh(
        trackGeo(new THREE.PlaneGeometry(0.62, 0.28)),
        cobaltAccentMat
      );
      screen.position.set(0, 1.34, -0.67);
      screen.rotation.x = -0.35;
      treadmillScreens.push(screen);
      tm.add(screen);

      scene.add(tm);
    };

    for (let i = 0; i < 6; i++) {
      buildTreadmill(2.0 + i * 1.45, -5.8);
    }

    const buildRower = (rx: number, rz: number) => {
      const rower = new THREE.Group();
      rower.position.set(rx, 0.04, rz);

      const rail = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.22, 0.1, 2.1)),
        brushedChromeMat
      );
      rail.position.set(0, 0.24, 0.15);
      rail.castShadow = true;
      rower.add(rail);

      const flywheel = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.26, 0.26, 0.18, 20)),
        darkSteelMat
      );
      flywheel.rotation.z = Math.PI / 2;
      flywheel.position.set(0, 0.42, -0.78);
      flywheel.castShadow = true;
      rower.add(flywheel);

      const seat = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.3, 0.07, 0.28)), leatherMat);
      seat.position.set(0, 0.34, 0.25);
      rower.add(seat);

      scene.add(rower);
    };

    for (let i = 0; i < 4; i++) {
      buildRower(2.6 + i * 1.9, -2.0);
    }

    // Zone 3: Studio A · Cycle & HIIT (8 Spin Bikes on tiered oak platform)
    const flywheels: THREE.Mesh[] = [];
    const buildSpinBike = (bx: number, bz: number) => {
      const bike = new THREE.Group();
      bike.position.set(bx, 0.04, bz);

      const base = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.55, 0.06, 1.15)), darkSteelMat);
      base.position.y = 0.03;
      bike.add(base);

      const frame = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.12, 0.65, 0.72)), slateFrameMat);
      frame.position.set(0, 0.42, 0);
      frame.castShadow = true;
      bike.add(frame);

      const wheel = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.24, 0.24, 0.07, 24)),
        brushedChromeMat
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.44, -0.35);
      flywheels.push(wheel);
      bike.add(wheel);

      const saddle = new THREE.Mesh(trackGeo(new THREE.BoxGeometry(0.2, 0.07, 0.28)), leatherMat);
      saddle.position.set(0, 0.88, 0.32);
      bike.add(saddle);

      const handlebar = new THREE.Mesh(
        trackGeo(new THREE.CylinderGeometry(0.025, 0.025, 0.48, 12)),
        darkSteelMat
      );
      handlebar.rotation.z = Math.PI / 2;
      handlebar.position.set(0, 0.96, -0.28);
      bike.add(handlebar);

      const tablet = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(0.22, 0.15, 0.02)),
        limeBeaconMat
      );
      tablet.position.set(0, 1.06, -0.28);
      tablet.rotation.x = -0.4;
      bike.add(tablet);

      scene.add(bike);
    };

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        buildSpinBike(-9.0 + col * 1.55, 2.4 + row * 2.4);
      }
    }

    // Zone 4: Recovery & Cryo Suite (Cedar Sauna Cabin + 2 Cold Plunges + Stretch Mats)
    const saunaGroup = new THREE.Group();
    saunaGroup.position.set(7.6, 0.04, 5.4);
    const saunaShell = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(3.4, 2.2, 2.8)),
      cedarWoodMat
    );
    saunaShell.position.y = 1.1;
    saunaShell.castShadow = true;
    saunaShell.receiveShadow = true;
    saunaGroup.add(saunaShell);

    const saunaGlass = new THREE.Mesh(
      trackGeo(new THREE.BoxGeometry(2.1, 1.75, 0.08)),
      trackMat(
        new THREE.MeshPhysicalMaterial({
          color: 0xfef3c7,
          roughness: 0.15,
          metalness: 0.05,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
        })
      )
    );
    saunaGlass.position.set(0, 1.05, 1.41);
    saunaGroup.add(saunaGlass);
    scene.add(saunaGroup);

    const buildPlunge = (px: number, pz: number) => {
      const plunge = new THREE.Group();
      plunge.position.set(px, 0.04, pz);

      const tub = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.75, 0.82, 1.05)),
        brushedChromeMat
      );
      tub.position.y = 0.41;
      tub.castShadow = true;
      plunge.add(tub);

      const water = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(1.5, 0.06, 0.82)),
        trackMat(
          new THREE.MeshStandardMaterial({
            color: 0x38bdf8,
            roughness: 0.1,
            metalness: 0.2,
            emissive: 0x0284c7,
            emissiveIntensity: 0.18,
          })
        )
      );
      water.position.y = 0.81;
      plunge.add(water);

      scene.add(plunge);
    };

    buildPlunge(2.6, 2.8);
    buildPlunge(2.6, 5.2);

    // Zone Selection Rings, Heatmap Halos & Raycast Proxies
    const zoneCoords: Record<ZoneId, [number, number]> = {
      lifting: [-5.6, -4.0],
      cardio: [5.6, -4.0],
      studio: [-5.6, 4.4],
      recovery: [5.6, 4.4],
    };

    const heatRings: Record<ZoneId, THREE.Mesh> = {} as Record<ZoneId, THREE.Mesh>;
    const beacons: Record<ZoneId, THREE.Mesh> = {} as Record<ZoneId, THREE.Mesh>;
    const hitProxies: THREE.Mesh[] = [];

    (Object.keys(zoneCoords) as ZoneId[]).forEach((zId) => {
      const [zx, zz] = zoneCoords[zId];

      const ringGeo = trackGeo(new THREE.RingGeometry(3.2, 3.55, 48));
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x059669,
          transparent: true,
          opacity: 0.32,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(zx, 0.06, zz);
      scene.add(ring);
      heatRings[zId] = ring;

      // Overhead telemetry pin
      const beacon = new THREE.Mesh(
        trackGeo(new THREE.OctahedronGeometry(0.28, 0)),
        trackMat(
          new THREE.MeshStandardMaterial({
            color: 0x84cc16,
            emissive: 0x84cc16,
            emissiveIntensity: 0.35,
            roughness: 0.25,
          })
        )
      );
      beacon.position.set(zx, 3.1, zz);
      scene.add(beacon);
      beacons[zId] = beacon;

      // Invisible raycast proxy on Layer 1
      const proxy = new THREE.Mesh(
        trackGeo(new THREE.BoxGeometry(10.4, 2.8, 7.4)),
        trackMat(new THREE.MeshBasicMaterial({ visible: false }))
      );
      proxy.position.set(zx, 1.4, zz);
      proxy.layers.set(1);
      proxy.userData.zoneId = zId;
      scene.add(proxy);
      hitProxies.push(proxy);
    });

    // Raycaster & Pointer Interaction
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverCheck = 0;

    const updatePointer = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Ignore drags
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const zId = hits[0].object.userData.zoneId as ZoneId;
        onSelectZoneRef.current(zId);
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 50) return;
      lastHoverCheck = now;
      updatePointer(e);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(hitProxies, false);
      if (hits.length > 0) {
        const zId = hits[0].object.userData.zoneId as ZoneId;
        setHoveredZone(zId);
        renderer.domElement.style.cursor = 'pointer';
      } else {
        setHoveredZone(null);
        renderer.domElement.style.cursor = 'grab';
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    // ResizeObserver
    const ro = new ResizeObserver(() => {
      if (!container) return;
      const w = container.clientWidth || 800;
      const h = container.clientHeight || 450;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(container);

    // Pre-warm shaders on GPU
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Animation loop with software WebGL afterDraw pacing
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
      const elapsed = clock.getElapsedTime();

      // Smooth damped camera preset transitions
      if (cameraGoalRef.current.active) {
        camera.position.x = THREE.MathUtils.damp(
          camera.position.x,
          cameraGoalRef.current.pos.x,
          6,
          delta
        );
        camera.position.y = THREE.MathUtils.damp(
          camera.position.y,
          cameraGoalRef.current.pos.y,
          6,
          delta
        );
        camera.position.z = THREE.MathUtils.damp(
          camera.position.z,
          cameraGoalRef.current.pos.z,
          6,
          delta
        );

        controls.target.x = THREE.MathUtils.damp(
          controls.target.x,
          cameraGoalRef.current.target.x,
          6,
          delta
        );
        controls.target.y = THREE.MathUtils.damp(
          controls.target.y,
          cameraGoalRef.current.target.y,
          6,
          delta
        );
        controls.target.z = THREE.MathUtils.damp(
          controls.target.z,
          cameraGoalRef.current.target.z,
          6,
          delta
        );

        if (
          camera.position.distanceTo(cameraGoalRef.current.pos) < 0.04 &&
          controls.target.distanceTo(cameraGoalRef.current.target) < 0.04
        ) {
          cameraGoalRef.current.active = false;
        }
      }

      controls.update();

      // Kinetic flywheel rotation
      for (let i = 0; i < flywheels.length; i++) {
        flywheels[i].rotation.x += delta * 4.5;
      }

      // Zone heatmap & beacon updates
      const activeSel = selectedZoneRef.current;
      const heatEnabled = showHeatmapRef.current;
      const curZones = zonesRef.current;

      curZones.forEach((z) => {
        const ratio = z.capacity > 0 ? z.occupancy / z.capacity : 0;
        const ring = heatRings[z.id];
        const beacon = beacons[z.id];
        const isSelected = activeSel === z.id;

        if (ring) {
          ring.visible = heatEnabled || isSelected;
          const rMat = ring.material as THREE.MeshBasicMaterial;
          if (ratio >= 0.8) rMat.color.setHex(0x84cc16);
          else if (ratio >= 0.6) rMat.color.setHex(0x059669);
          else rMat.color.setHex(0x2563eb);
          rMat.opacity = isSelected ? 0.65 : heatEnabled ? 0.25 + ratio * 0.2 : 0;
          const targetScale = isSelected ? 1.08 : 0.72 + ratio * 0.35;
          ring.scale.x = THREE.MathUtils.damp(ring.scale.x, targetScale, 8, delta);
          ring.scale.y = ring.scale.x;
        }

        if (beacon) {
          beacon.visible = heatEnabled || isSelected;
          beacon.position.y = 3.05 + Math.sin(elapsed * 2 + (z.id === 'cardio' ? 1 : 0)) * 0.12;
          beacon.rotation.y += delta * 1.2;
          const bMat = beacon.material as THREE.MeshStandardMaterial;
          if (isSelected) {
            bMat.color.setHex(0x84cc16);
            bMat.emissive.setHex(0x84cc16);
            bMat.emissiveIntensity = 0.65;
          } else {
            bMat.color.setHex(ratio >= 0.8 ? 0x84cc16 : 0x059669);
            bMat.emissive.setHex(ratio >= 0.8 ? 0x84cc16 : 0x059669);
            bMat.emissiveIntensity = 0.28;
          }
        }
      });

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleRestored);
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
    };
  }, []);

  const hoveredLabel = hoveredZone
    ? zones.find((z) => z.id === hoveredZone)?.name
    : null;

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F1F5F9] ${heightClass}`}
    >
      {/* Dedicated WebGL Mount */}
      <div ref={mountRef} className="w-full h-full" />

      {contextLost && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#F8FAFC] p-6 text-center z-20">
          <p className="font-display text-lg font-semibold text-[#0F172A]">
            3D Floor Viewport Paused
          </p>
          <p className="text-sm text-[#64748B] mt-1">
            Graphics context interrupted. Restoring spatial telemetry automatically.
          </p>
        </div>
      )}

      {/* Minimal Top-Left Live Capacity Beacon (Static, no backdrop-filter over WebGL) */}
      <div className="pointer-events-none absolute top-4 left-4 z-10 flex items-center gap-2.5 rounded-full border border-[#E2E8F0] bg-white/95 px-3.5 py-1.5 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08)]">
        <span
          className="h-2.5 w-2.5 rounded-full bg-[#84CC16] border border-[#65A30D]"
          aria-hidden="true"
        />
        <span className="text-xs font-semibold text-[#0F172A] tabular-nums whitespace-nowrap">
          Live Capacity · {totalOccupancy} / {maxCapacity}
        </span>
      </div>

      {/* Hover Zone Hint */}
      {hoveredLabel && (
        <div className="pointer-events-none absolute top-4 right-4 z-10 rounded-full border border-[#E2E8F0] bg-white/95 px-3 py-1 text-xs font-medium text-[#334155] shadow-xs">
          Click to inspect {hoveredLabel}
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center max-w-[94%]">
        <button
          type="button"
          onClick={() => setDockCollapsed((v) => !v)}
          className="mb-1.5 inline-flex items-center gap-1 rounded-full border border-[#E2E8F0] bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#334155] shadow-xs hover:text-[#0F172A] transition-colors cursor-pointer whitespace-nowrap"
        >
          {dockCollapsed ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Show Controls
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Hide Controls
            </>
          )}
        </button>

        {!dockCollapsed && (
          <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full border border-[#E2E8F0] bg-white/95 p-1.5 shadow-[0_8px_24px_-4px_rgba(15,23,42,0.08)]">
            <button
              type="button"
              onClick={handleResetView}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                selectedZone === 'all'
                  ? 'bg-[#0F172A] text-white'
                  : 'text-[#334155] hover:bg-[#F1F5F9]'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              All Zones
            </button>

            {zones.map((z) => (
              <button
                key={z.id}
                type="button"
                onClick={() => onSelectZone(z.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer tabular-nums ${
                  selectedZone === z.id
                    ? 'bg-[#059669] text-white'
                    : 'text-[#334155] hover:bg-[#F1F5F9]'
                }`}
              >
                {z.shortName}
                <span
                  className={`text-[10px] font-mono ${
                    selectedZone === z.id ? 'text-[#ECFDF5]' : 'text-[#64748B]'
                  }`}
                >
                  {z.occupancy}/{z.capacity}
                </span>
              </button>
            ))}

            <div className="h-4 w-px bg-[#E2E8F0] mx-0.5 hidden sm:block" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setShowHeatmap((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showHeatmap
                  ? 'bg-[#F7FEE7] text-[#3F6700] border border-[#BEF264]'
                  : 'text-[#64748B] hover:bg-[#F1F5F9]'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              Heatmap
            </button>

            <button
              type="button"
              onClick={handleResetView}
              title="Reset camera angle"
              className="inline-flex items-center justify-center rounded-full p-1.5 text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors cursor-pointer"
              aria-label="Reset camera"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
