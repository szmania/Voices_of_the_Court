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
            position: relative;
        }
        #empty-state {
            display: none;
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            color: #8a8a8a;
            pointer-events: none;
            z-index: 10;
        }
        #empty-state.visible {
            display: block;
        }
        #empty-state .empty-icon {
            font-size: 48px;
            margin-bottom: 12px;
            opacity: 0.5;
        }
        #empty-state .empty-message {
            font-size: 16px;
            font-weight: 500;
            margin-bottom: 6px;
        }
        #empty-state .empty-subtitle {
            font-size: 13px;
            opacity: 0.7;
        }
    </style>
    <div id="constellation-container">
        <div id="empty-state">
            <div class="empty-icon">&#11088;</div>
            <div class="empty-message" data-i18n="memory_constellation.empty_title">No Memories Found</div>
            <div class="empty-subtitle" data-i18n="memory_constellation.empty_subtitle">Memories will appear here as your character experiences events in the game.</div>
        </div>
    </div>
    `;
}

class MemoryConstellation extends HTMLElement {
    shadow: any;
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private container!: HTMLDivElement;
    private emptyState!: HTMLDivElement;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: "open" });
        template.innerHTML = defineTemplate();
        this.shadow.append(template.content.cloneNode(true));
    }

    async connectedCallback() {
        this.container = this.shadow.querySelector('#constellation-container');
        this.emptyState = this.shadow.querySelector('#empty-state') as HTMLDivElement;
        this.initThree();
        this.animateLoop();
        const characterId = this.getAttribute('character-id') || undefined;
        await this.loadMemories(undefined, characterId);
    }

    /**
     * Public method called by the renderer when player/character filter changes.
     * @param playerId - The selected player ID (or undefined for no filter)
     * @param characterId - The selected character ID (or undefined for all characters)
     */
    async reloadWithFilter(playerId?: string, characterId?: string) {
        await this.loadMemories(playerId, characterId);
    }

    async loadMemories(playerId?: string, characterId?: string) {
        try {
            const response = await ipcRenderer.invoke('get-memories', {
                playerId: playerId || '',
                characterId: characterId || ''
            });
            if (response && response.success && Array.isArray(response.memories)) {
                this.updatePoints(response.memories);
            } else {
                this.updatePoints([]);
            }
        } catch (error) {
            console.error('Failed to load memories:', error);
            this.updatePoints([]);
        }
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
            this.emptyState.classList.add('visible');
            return;
        }

        this.emptyState.classList.remove('visible');

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