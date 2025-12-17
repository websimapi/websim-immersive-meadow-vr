import * as THREE from 'three';

const VERTEX_SHADER = `
varying vec2 vUv;
varying float vSwipe;
uniform float time;
uniform vec3 interactors[4]; // Support up to 4 interaction points
uniform float interactorStrength[4];

// Simple noise function
float random (vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
}

void main() {
    vUv = uv;
    
    // Instance transform
    vec3 pos = position;
    vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
    
    // Wind calculation
    float noise = sin(time * 1.5 + worldPos.x * 0.5 + worldPos.z * 0.3);
    float windStrength = (pos.y / 1.0) * 0.5; // Only move top
    
    // Interaction Displacement
    vec3 displacement = vec3(0.0);
    float totalSwipe = 0.0;
    
    for(int i=0; i<4; i++) {
        vec3 intPos = interactors[i];
        float strength = interactorStrength[i];
        
        // Distance on XZ plane
        float dist = distance(worldPos.xz, intPos.xz);
        float radius = 1.0; 
        
        if(dist < radius && strength > 0.0) {
            float influence = (1.0 - dist / radius);
            influence = pow(influence, 2.0); // Sharper falloff
            
            vec3 dir = normalize(worldPos.xyz - intPos.xyz);
            dir.y = 0.0; // Push primarily horizontal
            
            // Push grass down and away
            displacement += dir * influence * 1.5;
            displacement.y -= influence * 0.8; 
            
            totalSwipe += influence;
        }
    }
    
    // Apply Wind
    if (pos.y > 0.1) {
        pos.x += noise * windStrength;
        pos.z += noise * windStrength * 0.5;
    }
    
    // Apply Interaction
    // We only displace the top vertices significantly
    if (pos.y > 0.0) {
        float stiffness = pos.y; // Bottom is rooted
        pos += displacement * stiffness;
    }
    
    vSwipe = clamp(totalSwipe, 0.0, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
}
`;

const FRAGMENT_SHADER = `
varying vec2 vUv;
varying float vSwipe;
uniform float time;

void main() {
    // Base colors
    vec3 baseColor = vec3(0.1, 0.4, 0.1); // Dark green
    vec3 tipColor = vec3(0.4, 0.7, 0.2); // Light green
    vec3 dryColor = vec3(0.6, 0.5, 0.2); // Dried grass tip
    
    // Mix base to tip
    vec3 color = mix(baseColor, tipColor, vUv.y);
    
    // Add some noise/variation
    // (In a real scenario we'd pass an attribute for variation)
    
    // Interaction highlight (slightly brighter where touched)
    color = mix(color, tipColor * 1.5, vSwipe * 0.5);
    
    // Simple Lighting (Fake normal)
    // We assume normal is roughly up+forward, influenced by swipe
    float light = 0.5 + 0.5 * vUv.y;
    
    gl_FragColor = vec4(color * light, 1.0);
}
`;

export class GrassSystem {
    constructor(scene, terrainHeightFn, inputs) {
        this.scene = scene;
        this.terrainHeightFn = terrainHeightFn; // Function to get Y for X,Z
        
        this.instanceCount = 100000;
        this.geometry = new THREE.PlaneGeometry(0.15, 1.0, 1, 4);
        this.geometry.translate(0, 0.5, 0); // Pivot at bottom
        
        this.material = new THREE.ShaderMaterial({
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            uniforms: {
                time: { value: 0 },
                interactors: { value: [new THREE.Vector3(0, -100, 0), new THREE.Vector3(0, -100, 0), new THREE.Vector3(0, -100, 0), new THREE.Vector3(0, -100, 0)] },
                interactorStrength: { value: [0, 0, 0, 0] }
            },
            side: THREE.DoubleSide
        });
        
        this.mesh = new THREE.InstancedMesh(this.geometry, this.material, this.instanceCount);
        this.mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
        this.scene.add(this.mesh);
        
        this.populateGrass();
    }
    
    populateGrass() {
        const dummy = new THREE.Object3D();
        const range = 50; // Spread radius
        
        for (let i = 0; i < this.instanceCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const r = Math.sqrt(Math.random()) * range; // Uniform distribution in circle
            
            const x = Math.cos(angle) * r;
            const z = Math.sin(angle) * r;
            
            // Add some jitter for natural look
            const y = this.terrainHeightFn(x, z);
            
            dummy.position.set(x, y, z);
            
            // Random rotation
            dummy.rotation.y = Math.random() * Math.PI * 2;
            
            // Random scale
            const s = 0.8 + Math.random() * 0.5;
            dummy.scale.set(s, s * (0.8 + Math.random() * 0.4), s);
            
            dummy.updateMatrix();
            this.mesh.setMatrixAt(i, dummy.matrix);
        }
        this.mesh.instanceMatrix.needsUpdate = true;
    }
    
    update(time, interactorsData) {
        this.material.uniforms.time.value = time;
        
        // Update interactors
        const uInteractors = this.material.uniforms.interactors.value;
        const uStrength = this.material.uniforms.interactorStrength.value;
        
        // Reset
        for(let i=0; i<4; i++) {
            uStrength[i] = 0.0;
        }
        
        // Fill
        for(let i=0; i < Math.min(interactorsData.length, 4); i++) {
            uInteractors[i].copy(interactorsData[i].pos);
            uStrength[i] = interactorsData[i].strength;
        }
    }
}

