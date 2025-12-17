import * as THREE from 'three';
import nipplejs from 'nipplejs';

export class Inputs {
    constructor(camera, domElement, xrManager) {
        this.camera = camera;
        this.domElement = domElement;
        this.xr = xrManager;
        
        // State
        this.moveVector = new THREE.Vector3();
        this.keys = {};
        this.isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        
        // VR Controllers
        this.controllers = [];
        this.controllerGrips = [];
        this.setupVR();

        // Desktop Inputs
        if (!this.isMobile) {
            this.setupDesktop();
        } else {
            this.setupMobile();
        }
    }

    setupVR() {
        // Setup controllers for tracking
        for (let i = 0; i < 2; i++) {
            const controller = this.xr.getController(i);
            this.controllers.push(controller);
            // We don't add them to scene here, handled by user if they want visuals, 
            // but we need them for tracking position for grass interaction.
            
            // Just add a invisible object to track position
            const tracker = new THREE.Group();
            controller.add(tracker);
        }
    }

    setupDesktop() {
        document.addEventListener('keydown', (e) => this.keys[e.code] = true);
        document.addEventListener('keyup', (e) => this.keys[e.code] = false);
        
        // Mouse Look
        this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
        this.domElement.addEventListener('click', () => {
            this.domElement.requestPointerLock();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === this.domElement) {
                this.euler.setFromQuaternion(this.camera.quaternion);
                this.euler.y -= e.movementX * 0.002;
                this.euler.x -= e.movementY * 0.002;
                this.euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.euler.x));
                this.camera.quaternion.setFromEuler(this.euler);
            }
        });
    }

    setupMobile() {
        const zone = document.getElementById('joystick-zone');
        zone.style.display = 'block';
        this.manager = nipplejs.create({
            zone: zone,
            mode: 'static',
            position: { left: '50%', top: '50%' },
            color: 'white'
        });

        this.manager.on('move', (evt, data) => {
            const forward = data.vector.y;
            const turn = data.vector.x;
            this.moveVector.z = -forward;
            this.moveVector.x = turn; 
        });

        this.manager.on('end', () => {
            this.moveVector.set(0, 0, 0);
        });
    }

    update(dt) {
        if (this.xr.isPresenting) {
            // VR Movement typically handled by controller thumbsticks, 
            // Simplifying to just physical walking/teleport for this demo to focus on interaction
            // Or simple gaze-based movement if buttons pressed (omitted for brevity/safety)
            return;
        }

        const speed = 3.0 * dt;
        const direction = new THREE.Vector3();

        if (this.isMobile) {
            // Mobile movement logic
            direction.set(this.moveVector.x, 0, this.moveVector.z);
            direction.applyQuaternion(this.camera.quaternion);
            direction.y = 0;
            direction.normalize().multiplyScalar(speed);
            this.camera.position.add(direction);
        } else {
            // Desktop WASD
            if (this.keys['KeyW']) direction.z -= 1;
            if (this.keys['KeyS']) direction.z += 1;
            if (this.keys['KeyA']) direction.x -= 1;
            if (this.keys['KeyD']) direction.x += 1;
            
            direction.applyQuaternion(this.camera.quaternion);
            direction.y = 0; // Flat movement
            if (direction.lengthSq() > 0) direction.normalize().multiplyScalar(speed);
            this.camera.position.add(direction);
        }
    }

    getInteractors() {
        // Returns array of positions {x, y, z} and radius for grass interaction
        const interactors = [];
        
        // Player body
        interactors.push({ 
            pos: new THREE.Vector3(this.camera.position.x, this.camera.position.y - 1.0, this.camera.position.z), 
            radius: 0.8,
            strength: 1.0
        });

        // VR Hands
        if (this.xr.isPresenting) {
            this.controllers.forEach(c => {
                interactors.push({
                    pos: c.position,
                    radius: 0.3,
                    strength: 1.5
                });
            });
        }

        return interactors;
    }
}

