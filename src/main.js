import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { World } from './World.js';
import { GrassSystem } from './GrassSystem.js';
import { Inputs } from './Inputs.js';
import { AudioController } from './AudioController.js';

class App {
    constructor() {
        this.clock = new THREE.Clock();
        
        // Setup Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.02);

        // Setup Camera
        this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.7, 0); // Eye height

        // Setup Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.xr.enabled = true;
        document.body.appendChild(this.renderer.domElement);
        document.body.appendChild(VRButton.createButton(this.renderer));

        // Subsystems
        this.inputs = new Inputs(this.camera, this.renderer.domElement, this.renderer.xr);
        this.world = new World(this.scene, this.renderer);
        this.grass = new GrassSystem(this.scene, this.world.terrainHeightMap, this.inputs);
        this.audio = new AudioController(this.camera);

        // Resize Handler
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Start Loop
        this.renderer.setAnimationLoop(this.render.bind(this));
        
        // Initial Audio Context trigger
        document.body.addEventListener('click', () => this.audio.init(), { once: true });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        const dt = this.clock.getDelta();
        const time = this.clock.getElapsedTime();

        // Update Logic
        this.inputs.update(dt);
        this.world.update(time, this.camera);
        this.grass.update(time, this.inputs.getInteractors());
        
        // Sync camera rig height with terrain if not in VR or simply clamp to ground
        if (!this.renderer.xr.isPresenting) {
            const pos = this.camera.position;
            const terrainHeight = this.world.getTerrainHeightAt(pos.x, pos.z);
            // Simple walking physics
            pos.y = Math.max(pos.y, terrainHeight + 1.7);
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new App();

