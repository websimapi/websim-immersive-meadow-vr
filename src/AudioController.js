import * as THREE from 'three';

export class AudioController {
    constructor(camera) {
        this.camera = camera;
        this.listener = new THREE.AudioListener();
        this.camera.add(this.listener);
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;
        this.initialized = true;

        const sound = new THREE.Audio(this.listener);
        const audioLoader = new THREE.AudioLoader();
        
        audioLoader.load('wind_ambience.mp3', (buffer) => {
            sound.setBuffer(buffer);
            sound.setLoop(true);
            sound.setVolume(0.5);
            sound.play();
        });
        
        // Resume context if needed (browsers block auto-play)
        if (this.listener.context.state === 'suspended') {
            this.listener.context.resume();
        }
    }
}

