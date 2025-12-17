import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';
import { Sky } from 'three/addons/objects/Sky.js';

export class World {
    constructor(scene, renderer) {
        this.scene = scene;
        this.renderer = renderer;
        this.noise2D = createNoise2D();
        
        this.setupLights();
        this.setupSky();
        this.setupTerrain();
        this.setupEnvironment();
    }

    setupLights() {
        this.ambientLight = new THREE.AmbientLight(0x404040, 0.2); // Soft white light
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -50;
        this.sunLight.shadow.camera.right = 50;
        this.sunLight.shadow.camera.top = 50;
        this.sunLight.shadow.camera.bottom = -50;
        this.scene.add(this.sunLight);
    }

    setupSky() {
        this.sky = new Sky();
        this.sky.scale.setScalar(450000);
        this.scene.add(this.sky);

        this.sunParams = {
            turbidity: 10,
            rayleigh: 3,
            mieCoefficient: 0.005,
            mieDirectionalG: 0.7,
            elevation: 2,
            azimuth: 180,
            exposure: 0.5
        };

        const uniforms = this.sky.material.uniforms;
        uniforms['turbidity'].value = this.sunParams.turbidity;
        uniforms['rayleigh'].value = this.sunParams.rayleigh;
        uniforms['mieCoefficient'].value = this.sunParams.mieCoefficient;
        uniforms['mieDirectionalG'].value = this.sunParams.mieDirectionalG;

        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    }

    setupTerrain() {
        const geometry = new THREE.PlaneGeometry(100, 100, 100, 100);
        geometry.rotateX(-Math.PI / 2);

        // Displace vertices
        const pos = geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const x = pos.getX(i);
            const z = pos.getZ(i);
            const y = this.getTerrainHeightAt(x, z);
            pos.setY(i, y);
        }
        geometry.computeVertexNormals();

        const textureLoader = new THREE.TextureLoader();
        const groundTexture = textureLoader.load('ground_diffuse.png');
        groundTexture.wrapS = THREE.RepeatWrapping;
        groundTexture.wrapT = THREE.RepeatWrapping;
        groundTexture.repeat.set(20, 20);

        const material = new THREE.MeshStandardMaterial({
            map: groundTexture,
            roughness: 0.8,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.receiveShadow = true;
        this.scene.add(this.terrain);
    }

    setupEnvironment() {
        // Distant Trees
        const treeTex = new THREE.TextureLoader().load('tree_line.png');
        const treeMat = new THREE.MeshBasicMaterial({ 
            map: treeTex, 
            transparent: true, 
            side: THREE.DoubleSide,
            fog: true 
        });

        const treeCount = 12;
        const radius = 45;
        for(let i=0; i<treeCount; i++) {
            const angle = (i / treeCount) * Math.PI * 2;
            const w = 20;
            const h = 10;
            const geom = new THREE.PlaneGeometry(w, h);
            const mesh = new THREE.Mesh(geom, treeMat);
            
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = this.getTerrainHeightAt(x, z) + h/2 - 1;

            mesh.position.set(x, y, z);
            mesh.lookAt(0, y, 0);
            this.scene.add(mesh);
        }

        // Clouds
        const cloudTex = new THREE.TextureLoader().load('cloud.png');
        const cloudMat = new THREE.MeshBasicMaterial({
            map: cloudTex,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        
        for(let i=0; i<15; i++) {
            const w = 20 + Math.random() * 20;
            const h = w;
            const geom = new THREE.PlaneGeometry(w, h);
            const mesh = new THREE.Mesh(geom, cloudMat);
            
            mesh.position.set(
                (Math.random() - 0.5) * 200,
                30 + Math.random() * 20,
                (Math.random() - 0.5) * 200
            );
            mesh.rotation.x = Math.PI / 2;
            mesh.rotation.z = Math.random() * Math.PI;
            this.scene.add(mesh);
        }
    }

    getTerrainHeightAt(x, z) {
        // Multi-octave noise
        let y = 0;
        y += this.noise2D(x * 0.02, z * 0.02) * 4;
        y += this.noise2D(x * 0.1, z * 0.1) * 0.5;
        y += this.noise2D(x * 0.5, z * 0.5) * 0.1;
        
        // Flatten center for starting area
        const dist = Math.sqrt(x*x + z*z);
        if (dist < 5) {
            y *= (dist / 5);
        }
        
        return y;
    }

    update(time, camera) {
        // Day/Night Cycle
        // Cycle duration: 60 seconds for demo purposes
        const cycleDuration = 120; 
        const cycle = (time % cycleDuration) / cycleDuration;
        
        // Sun elevation: -10 to 90 degrees roughly
        const phi = (cycle * 2 * Math.PI) - (Math.PI / 2);
        
        // We only want daylight for most of the demo? 
        // Let's make it a nice slow sunset/sunrise loop.
        // Let's oscillate phi between 0 (horizon) and PI/2 (zenith)
        // Actually user wants full cycle.
        
        const elevation = Math.sin(time * 0.1) * 40 + 10; // Keeping it day-ish for visibility mostly, dipping low
        // Or strictly following request:
        // Let's do a simple accelerated day.
        
        const sunPos = new THREE.Vector3();
        // Move sun in sky
        const theta = Math.PI * (0.1); // Fixed azimuth
        const phiSun = THREE.MathUtils.degToRad(90 - (Math.sin(time * 0.05) * 80 + 10)); // 90 is zenith

        sunPos.setFromSphericalCoords(1, phiSun, theta);

        this.sunLight.position.copy(sunPos).multiplyScalar(100);
        this.sky.material.uniforms['sunPosition'].value.copy(this.sunLight.position);

        // Adjust light intensity based on elevation
        const sunHeight = Math.cos(phiSun);
        this.sunLight.intensity = Math.max(0, sunHeight) * 1.5;
        this.ambientLight.intensity = Math.max(0.1, sunHeight * 0.3);

        // Fog color matching
        // Simple approximation
        if (sunHeight > 0.5) {
            this.scene.fog.color.setHSL(0.6, 0.5, 0.7); // Blueish day
        } else if (sunHeight > 0.0) {
            this.scene.fog.color.setHSL(0.05, 0.8, 0.6); // Orange sunset
        } else {
            this.scene.fog.color.setHSL(0.65, 0.8, 0.05); // Dark night
        }
        this.scene.background.copy(this.scene.fog.color);
    }
}

