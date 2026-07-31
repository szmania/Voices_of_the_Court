import { ipcRenderer } from 'electron';
import * as THREE from 'three';

const template = document.createElement("template");

function defineTemplate() {
    return `
    <link rel="stylesheet" href="../../public/configWindow/config.css">
    <style>
        #constellation-container {
            width: 100%;
            height: 500px;
            border: 1px solid #5a4a35;
        }
    </style>
    <div id="constellation-container"></div>
    `;
}

class MemoryConstellation extends HTMLElement {
    shadow: any;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private container!: HTMLDivElement;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: "open" });
        template.innerHTML = defineTemplate();
        this.shadow.append(template.content.cloneNode(true));
    }

    async connectedCallback() {
        this.container = this.shadow.querySelector('#constellation-container');
        this.initThree();
        this.animateLoop();
        const memories = await ipcRenderer.invoke('get-memories');
        this.updatePoints(memories);
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, this.container.clientWidth / this.container.clientHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.z = 5;
    }

    updatePoints(memories: any[]) {
        // Clear existing points
        while(this.scene.children.length > 0){ 
            this.scene.remove(this.scene.children[0]); 
        }

        if (!memories || memories.length === 0) {
            return;
        }

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(memories.length * 3);

        memories.forEach((memory: any, i: number) => {
            // This is a placeholder for the PCA projection
            positions[i * 3] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 10;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 10;
        });

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 });
        const points = new THREE.Points(geometry, material);
        this.scene.add(points);
    }
    private animateLoop = () => {
        requestAnimationFrame(this.animateLoop);
        this.renderer.render(this.scene, this.camera);
    }
}

customElements.define("memory-constellation", MemoryConstellation);