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
            resize: vertical;
            overflow: hidden;
            min-height: 200px;
            cursor: grab;
        }
        #constellation-container.dragging {
            cursor: grabbing;
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
        #memory-tooltip {
            position: absolute;
            top: 10px;
            left: 10px;
            max-width: 320px;
            max-height: 220px;
            overflow-y: auto;
            background: rgba(0, 0, 0, 0.88);
            border: 1px solid #5a4a35;
            border-radius: 4px;
            padding: 10px 12px;
            color: #e0e0e0;
            font-size: 12px;
            line-height: 1.5;
            z-index: 20;
            pointer-events: none;
            white-space: pre-wrap;
            word-break: break-word;
            box-shadow: 0 2px 10px rgba(0,0,0,0.5);
        }
        #memory-tooltip .tooltip-title {
            font-weight: bold;
            color: #cca43b;
            margin-bottom: 6px;
            font-size: 13px;
        }
        #memory-tooltip .tooltip-meta {
            color: #8a8a8a;
            font-size: 11px;
            margin-top: 6px;
        }
        #zoom-hint {
            position: absolute;
            bottom: 8px;
            right: 10px;
            color: #6a6a6a;
            font-size: 11px;
            pointer-events: none;
            z-index: 20;
        }
    </style>
    <div id="constellation-container">
        <div id="empty-state">
            <div class="empty-icon">&#11088;</div>
            <div class="empty-message" data-i18n="memory_constellation.empty_title">No Memories Found</div>
            <div class="empty-subtitle" data-i18n="memory_constellation.empty_subtitle">Memories will appear here as your character experiences events in the game.</div>
        </div>
        <div id="memory-tooltip" style="display: none;"></div>
        <div id="zoom-hint">Scroll to zoom &middot; Drag to rotate</div>
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
    private tooltip!: HTMLDivElement;
    private points!: THREE.Points;
    private memories: any[] = [];
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private isDragging = false;
    private dragStart = { x: 0, y: 0 };
    private rotationStart = { x: 0, y: 0 };
    private autoRotate = true;

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: "open" });
        template.innerHTML = defineTemplate();
        this.shadow.append(template.content.cloneNode(true));
    }

    async connectedCallback() {
        this.container = this.shadow.querySelector('#constellation-container');
        this.emptyState = this.shadow.querySelector('#empty-state') as HTMLDivElement;
        this.tooltip = this.shadow.querySelector('#memory-tooltip') as HTMLDivElement;
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

        // Resize the Three.js canvas dynamically when the container is resized
        const resizeObserver = new ResizeObserver(() => {
            if (!this.container) return;
            const width = this.container.clientWidth;
            const height = this.container.clientHeight;
            this.camera.aspect = width / height;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(width, height);
        });
        resizeObserver.observe(this.container);

        // Zoom with the mouse wheel
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.autoRotate = false;
            const delta = e.deltaY * 0.01;
            this.camera.position.z = Math.max(2, Math.min(20, this.camera.position.z + delta));
        }, { passive: false });

        // Drag to rotate
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.autoRotate = false;
            this.container.classList.add('dragging');
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.rotationStart = { x: this.scene.rotation.y, y: this.scene.rotation.x };
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                this.scene.rotation.y = this.rotationStart.x + dx * 0.01;
                this.scene.rotation.x = this.rotationStart.y + dy * 0.01;
            } else {
                this.handleHover(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.container.classList.remove('dragging');
            }
        });
    }

    private handleHover(e: MouseEvent) {
        if (!this.points || this.memories.length === 0) return;
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.params.Points!.threshold = 0.3;
        const intersects = this.raycaster.intersectObject(this.points);
        if (intersects.length > 0) {
            const index = intersects[0].index;
            if (index !== undefined && this.memories[index]) {
                this.showTooltip(this.memories[index]);
            } else {
                this.hideTooltip();
            }
        } else {
            this.hideTooltip();
        }
    }
    private showTooltip(memory: any) {
        const date = memory.timestamp ? new Date(memory.timestamp).toLocaleString() : '';
        const emotion = memory.emotion ? memory.emotion : '';
        this.tooltip.innerHTML = `
            <div class="tooltip-title">Memory</div>
            <div>${this.escapeHtml(memory.text || '')}</div>
            <div class="tooltip-meta">${emotion ? 'Emotion: ' + this.escapeHtml(emotion) + '<br>' : ''}${date ? 'Date: ' + this.escapeHtml(date) : ''}</div>
        `;
        this.tooltip.style.display = 'block';
    }

    private hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    private escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    updatePoints(memories: any[]) {
        // Clear existing points
        while(this.scene.children.length > 0){ 
            this.scene.remove(this.scene.children[0]); 
        }
        this.hideTooltip();
        this.memories = memories || [];

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
        const material = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15 });
        this.points = new THREE.Points(geometry, material);
        this.scene.add(this.points);
    }

    private animateLoop = () => {
        requestAnimationFrame(this.animateLoop);
        if (this.autoRotate) {
            const time = Date.now() * 0.001;
            this.scene.rotation.y = time * 0.1;
            this.scene.rotation.x = Math.sin(time * 0.05) * 0.1;
        }
        this.renderer.render(this.scene, this.camera);
    }
}

customElements.define("memory-constellation", MemoryConstellation);