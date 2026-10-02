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
            max-height: 280px;
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
            margin-bottom: 6px;
            padding-bottom: 6px;
            border-bottom: 1px solid rgba(204, 164, 59, 0.35);
        }
        /* Always-visible affordance hinting that hovering the bottom-middle reveals search */
        #search-hint {
            position: absolute;
            bottom: 8px;
            left: 50%;
            transform: translateX(-50%);
            color: #8a8a8a;
            font-size: 11px;
            opacity: 0.45;
            pointer-events: none;
            z-index: 26;
            transition: opacity 0.18s ease;
            white-space: nowrap;
        }
        #search-hint.hidden {
            opacity: 0;
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
        /* Sticky editable memory editor popup */
        #memory-editor {
            position: absolute;
            top: 10px;
            right: 10px;
            width: 340px;
            max-height: calc(100% - 20px);
            display: none;
            flex-direction: column;
            background: rgba(0, 0, 0, 0.92);
            border: 1px solid #cca43b;
            border-radius: 4px;
            padding: 12px;
            color: #e0e0e0;
            font-size: 12px;
            z-index: 30;
            box-shadow: 0 4px 16px rgba(0,0,0,0.6);
        }
        #memory-editor.visible {
            display: flex;
        }
        #memory-editor .editor-title {
            font-weight: bold;
            color: #cca43b;
            font-size: 14px;
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
        }
        #memory-editor .editor-close {
            background: none;
            border: none;
            color: #8a8a8a;
            font-size: 18px;
            cursor: pointer;
            padding: 0 4px;
            line-height: 1;
        }
        #memory-editor .editor-close:hover {
            color: #ffd700;
        }
        #memory-editor .editor-field {
            margin-bottom: 8px;
        }
        #memory-editor .editor-label {
            color: #8a8a8a;
            font-size: 11px;
            margin-bottom: 3px;
            display: block;
        }
        #memory-editor textarea {
            width: 100%;
            min-height: 120px;
            max-height: 240px;
            overflow-y: auto;
            background: #1a1a1a;
            color: #e0e0e0;
            border: 1px solid #5a4a35;
            border-radius: 3px;
            padding: 6px 8px;
            font-size: 12px;
            font-family: inherit;
            line-height: 1.5;
            resize: vertical;
            box-sizing: border-box;
        }
        #memory-editor textarea:focus {
            outline: none;
            border-color: #cca43b;
        }
        #memory-editor input[type="text"] {
            width: 100%;
            background: #1a1a1a;
            color: #e0e0e0;
            border: 1px solid #5a4a35;
            border-radius: 3px;
            padding: 5px 8px;
            font-size: 12px;
            box-sizing: border-box;
        }
        #memory-editor input[type="text"]:focus {
            outline: none;
            border-color: #cca43b;
        }
        #memory-editor .editor-meta {
            color: #8a8a8a;
            font-size: 11px;
            margin-bottom: 8px;
        }
        #memory-editor .editor-actions {
            display: flex;
            gap: 8px;
            justify-content: flex-end;
            margin-top: 4px;
        }
        #memory-editor .editor-actions button {
            background-color: #591919;
            color: #e0e0e0;
            border: 1px solid #8c2b2b;
            border-radius: 2px;
            padding: 6px 14px;
            font-family: inherit;
            font-size: 12px;
            cursor: pointer;
            transition: all 0.2s;
        }
        #memory-editor .editor-actions button:hover {
            background-color: #7a2222;
            border-color: #cca43b;
            color: #fff;
        }
        #memory-editor .editor-actions button.save-btn {
            background-color: #1a5c1a;
            border-color: #2a8c2a;
        }
        #memory-editor .editor-actions button:disabled {
            opacity: 0.4;
            cursor: not-allowed;
        }
        #memory-editor .editor-actions button.save-btn:hover {
            background-color: #2a7c2a;
            border-color: #cca43b;
        }
        #memory-editor .editor-status {
            font-size: 11px;
            margin-top: 6px;
            min-height: 14px;
        }
        #memory-editor .editor-status.success { color: #8af88a; }
        #memory-editor .editor-status.error { color: #f88a8a; }
        /* Bottom-middle hover reveal zone for the search bar */
        #search-reveal-zone {
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 320px;
            height: 28px;
            z-index: 25;
        }
        #search-bar {
            position: absolute;
            bottom: 8px;
            left: 50%;
            transform: translate(-50%, 120%);
            display: flex;
            align-items: center;
            gap: 6px;
            width: 320px;
            background: rgba(0, 0, 0, 0.92);
            border: 1px solid #cca43b;
            border-radius: 4px;
            padding: 6px 8px;
            z-index: 30;
            box-shadow: 0 4px 16px rgba(0,0,0,0.6);
            opacity: 0;
            pointer-events: none;
            transition: transform 0.18s ease, opacity 0.18s ease;
        }
        #search-bar.visible {
            transform: translate(-50%, 0);
            opacity: 1;
            pointer-events: auto;
        }
        #search-bar input[type="text"] {
            flex: 1;
            min-width: 0;
            background: #1a1a1a;
            color: #e0e0e0;
            border: 1px solid #5a4a35;
            border-radius: 3px;
            padding: 5px 8px;
            font-size: 12px;
            font-family: inherit;
            box-sizing: border-box;
        }
        #search-bar input[type="text"]:focus {
            outline: none;
            border-color: #cca43b;
        }
        #search-bar .search-counter {
            color: #8a8a8a;
            font-size: 11px;
            white-space: nowrap;
            min-width: 44px;
            text-align: center;
        }
        #search-bar button {
            background-color: #591919;
            color: #e0e0e0;
            border: 1px solid #8c2b2b;
            border-radius: 2px;
            padding: 4px 8px;
            font-family: inherit;
            font-size: 12px;
            cursor: pointer;
            line-height: 1;
        }
        #search-bar button:hover {
            background-color: #7a2222;
            border-color: #cca43b;
            color: #fff;
        }
        #memory-tooltip mark {
            background: #cca43b;
            color: #1a1a1a;
            border-radius: 2px;
            padding: 0 1px;
        }
    </style>
    <div id="constellation-container">
        <div id="empty-state">
            <div class="empty-icon">&#11088;</div>
            <div class="empty-message" data-i18n="memory_constellation.empty_title">No Memories Found</div>
            <div class="empty-subtitle" data-i18n="memory_constellation.empty_subtitle">Memories will appear here as your character experiences events in the game.</div>
        </div>
        <div id="memory-tooltip" style="display: none;"></div>
        <div id="memory-editor">
            <div class="editor-title">
                <span data-i18n="memory_constellation.editor_title">Memory</span>
                <button class="editor-close" id="editor-close-btn" title="Close">&times;</button>
            </div>
            <div class="editor-meta" id="editor-meta"></div>
            <div class="editor-field">
                <label class="editor-label" for="editor-text" data-i18n="memory_constellation.editor_text_label">Memory Text</label>
                <textarea id="editor-text"></textarea>
            </div>
            <div class="editor-field">
                <label class="editor-label" for="editor-emotion" data-i18n="memory_constellation.editor_emotion_label">Emotion</label>
                <input type="text" id="editor-emotion" />
            </div>
            <div class="editor-actions">
                <button id="editor-save-btn" class="save-btn" data-i18n="memory_constellation.editor_save">Save</button>
            </div>
            <div class="editor-status" id="editor-status"></div>
        </div>
        <div id="zoom-hint">Scroll to zoom &middot; Drag to rotate &middot; Right-drag to pan &middot; Click a node to edit</div>
        <div id="search-hint" data-i18n="memory_constellation.search_hint">&#128269; Search memories (hover here)</div>
        <div id="search-reveal-zone"></div>
        <div id="search-bar">
            <input type="text" id="search-input" data-i18n-placeholder="memory_constellation.search_placeholder" placeholder="Search memories..." />
            <span class="search-counter" id="search-counter">0 / 0</span>
            <button id="search-prev" data-i18n-title="memory_constellation.search_prev_tooltip" title="Previous match">&#9650;</button>
            <button id="search-next" data-i18n-title="memory_constellation.search_next_tooltip" title="Next match">&#9660;</button>
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
    private selectedIndex: number | null = null;
    private hoveredIndex: number | null = null;
    private linePairs: number[][] = [];
    private basePointColors: Float32Array | null = null;
    private selectedRing: THREE.Sprite | null = null;
    private ringTexture: THREE.Texture | null = null;
    private memories: any[] = [];
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private isDragging = false;
    private isPanning = false;
    private panStart = { x: 0, y: 0 };
    private dragStart = { x: 0, y: 0 };
    private rotationStart = { x: 0, y: 0 };
    private autoRotate = true;
    private editor!: HTMLDivElement;
    private pinnedMemory: any = null;
    private mouseDownPos = { x: 0, y: 0 };
    private characterMap: Record<string, string> = {};
    // Parallel metadata for each rendered relation-line segment (index -> shared characterId), for hover tooltips.
    private lineReasons: string[] = [];
    private lines: THREE.LineSegments | null = null;
    private editorDrag = { dragging: false, startX: 0, startY: 0, origLeft: 0, origTop: 0 };
    // Search state: term, matching memory indices, and the current match cursor.
    private searchTerm = '';
    private searchMatches: number[] = [];
    private searchCursor = -1;
    // Signature of the last rendered dataset, used to skip redundant rebuilds.
    private lastDataSignature = '';
    // Fixed orthonormal projection basis for deterministic 3D positions (built once).
    private projectionBasis: THREE.Vector3[] | null = null;

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
        this.editor = this.shadow.querySelector('#memory-editor') as HTMLDivElement;
        const charMapAttr = this.getAttribute('character-map');
        if (charMapAttr) {
            try { this.characterMap = JSON.parse(charMapAttr); } catch (e) { this.characterMap = {}; }
        }
        this.initThree();
        this.setupEditor();
        this.setupSearchBar();
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

        // Wheel: scroll the hovered memory popup when one is open; otherwise zoom.
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            // When a node tooltip is showing, the wheel scrolls the popup instead of
            // zooming the camera (the popup is the only way to read a long memory).
            if (this.hoveredIndex !== null && this.tooltip.style.display === 'block') {
                this.tooltip.scrollTop += e.deltaY;
                return;
            }
            this.autoRotate = false;
            const delta = e.deltaY * 0.01;
            this.camera.position.z = Math.max(2, Math.min(20, this.camera.position.z + delta));
        }, { passive: false });

        // Drag to rotate (left button) or pan (right / middle button)
        this.container.addEventListener('contextmenu', (e) => e.preventDefault());
        this.container.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.isPanning = e.button === 2 || e.button === 1;
            this.autoRotate = false;
            this.container.classList.add('dragging');
            this.dragStart = { x: e.clientX, y: e.clientY };
            this.rotationStart = { x: this.scene.rotation.y, y: this.scene.rotation.x };
            this.panStart = { x: this.camera.position.x, y: this.camera.position.y };
            this.mouseDownPos = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mousemove', (e) => {
            if (this.isDragging) {
                const dx = e.clientX - this.dragStart.x;
                const dy = e.clientY - this.dragStart.y;
                if (this.isPanning) {
                    const panScale = this.camera.position.z * 0.0016;
                    this.camera.position.x = this.panStart.x - dx * panScale;
                    this.camera.position.y = this.panStart.y + dy * panScale;
                } else {
                    this.scene.rotation.y = this.rotationStart.x + dx * 0.01;
                    this.scene.rotation.x = this.rotationStart.y + dy * 0.01;
                }
            } else {
                this.handleHover(e);
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.isPanning = false;
                this.container.classList.remove('dragging');
            }
        });

        // Click a node to pin the editable popup (only if it wasn't a drag)
        this.container.addEventListener('click', (e) => {
            if (Math.abs(e.clientX - this.mouseDownPos.x) > 5 || Math.abs(e.clientY - this.mouseDownPos.y) > 5) return; // was a drag, not a click
            const index = this.pickMemoryAt(e);
            if (index !== null) {
                this.setSelectedIndex(index);
                this.showEditor(this.memories[index]);
            } else {
                this.setSelectedIndex(null);
            }
        });

        // Double-click a node opens the same editor popup (same raycast + drag guard as click).
        this.container.addEventListener('dblclick', (e) => {
            if (Math.abs(e.clientX - this.mouseDownPos.x) > 5 || Math.abs(e.clientY - this.mouseDownPos.y) > 5) return; // was a drag, not a click
            const index = this.pickMemoryAt(e);
            if (index !== null) {
                this.setSelectedIndex(index);
                this.showEditor(this.memories[index]);
            }
        });
    }

    /**
     * Shared raycast-pick used by the click/dblclick handlers.
     * Returns the index of the picked memory node, or null when nothing was hit.
     */
    private pickMemoryAt(e: MouseEvent): number | null {
        if (!this.points || this.memories.length === 0) return null;
        const rect = this.container.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.raycaster.params.Points!.threshold = 0.3;
        const intersects = this.raycaster.intersectObject(this.points);
        if (intersects.length > 0) {
            const index = intersects[0].index;
            if (index !== undefined && this.memories[index]) return index;
        }
        return null;
    }

    /**
     * Highlights the picked node with a halo ring sprite so the selection stays
     * visible while the scene auto-rotates. Pass null to clear the selection.
     */
    private setSelectedIndex(index: number | null): void {
        this.selectedIndex = index;
        if (this.selectedRing) {
            this.scene.remove(this.selectedRing);
            this.selectedRing = null;
        }
        if (index === null || !this.points) return;
        const positionAttr = this.points.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (!positionAttr) return;

        // Lazily build the annulus ring texture: transparent center, bright gold ring band.
        if (!this.ringTexture) {
            const canvas = document.createElement('canvas');
            canvas.width = 64;
            canvas.height = 64;
            const ctx = canvas.getContext('2d')!;
            const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            gradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
            gradient.addColorStop(0.55, 'rgba(204, 164, 59, 0)');
            gradient.addColorStop(0.72, 'rgba(255, 215, 0, 1)');
            gradient.addColorStop(0.82, 'rgba(204, 164, 59, 0.9)');
            gradient.addColorStop(1, 'rgba(204, 164, 59, 0)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, 64, 64);
            this.ringTexture = new THREE.CanvasTexture(canvas);
        }

        const x = positionAttr.getX(index);
        const y = positionAttr.getY(index);
        const z = positionAttr.getZ(index);
        const ring = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.ringTexture,
            color: 0xffffff,
            transparent: true,
            depthWrite: false
        }));
        ring.scale.set(1.5, 1.5, 1);
        ring.position.set(x, y, z);
        this.selectedRing = ring;
        this.scene.add(ring);
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
                this.setHoveredIndex(index);
                this.showTooltip(this.memories[index]);
            } else {
                this.setHoveredIndex(null);
                this.hideTooltip();
            }
        } else if (this.lines && this.lineReasons.length > 0) {
            // No node hit — clear the hover highlight, then try relation-line hover
            // so the user can read WHY a link exists.
            this.setHoveredIndex(null);
            this.raycaster.params.Line!.threshold = 0.2;
            const lineHits = this.raycaster.intersectObject(this.lines);
            let shown = false;
            if (lineHits.length > 0) {
                const idx = lineHits[0].index;
                if (idx !== undefined) {
                    // LineSegments intersections index vertices (2 per segment), so halve to get the segment index.
                    const characterId = this.lineReasons[idx >>> 1] || '';
                    const name = this.getCharacterName(characterId);
                    const t = (k: string, d: string) => ((window as any).LocalizationManager?.getTranslation(k, d) ?? d);
                    this.tooltip.innerHTML = '<div>' + this.escapeHtml(t('memory_constellation.edge_tooltip_same_character', 'Linked memories — both belong to {characterName}').replace('{characterName}', name)) + '</div>';
                    this.tooltip.style.display = 'block';
                    shown = true;
                }
            }
            if (!shown) this.hideTooltip();
        } else {
            this.setHoveredIndex(null);
            this.hideTooltip();
        }
    }

    /** Sets the hovered node (null = none) and refreshes the relation highlight. */
    private setHoveredIndex(index: number | null): void {
        if (this.hoveredIndex === index) return;
        this.hoveredIndex = index;
        this.applyHoverHighlight(index);
    }

    /**
     * Highlights every relation line touching the hovered node plus the nodes those
     * lines connect to (bright gold), restoring the base colors when the hover clears.
     * Uses per-vertex colors on both the line and point geometries, so no shader is needed.
     */
    private applyHoverHighlight(index: number | null): void {
        const gold = { r: 1.0, g: 0.843, b: 0.0 }; // 0xffd700
        const dim = { r: 0x5a / 255, g: 0x4a / 255, b: 0x35 / 255 };
        if (this.lines) {
            const colorAttr = this.lines.geometry.getAttribute('color') as THREE.BufferAttribute;
            if (colorAttr) {
                for (let s = 0; s < this.linePairs.length; s++) {
                    const pair = this.linePairs[s];
                    const related = index !== null && (pair[0] === index || pair[1] === index);
                    const c = related ? gold : dim;
                    colorAttr.setXYZ(s * 2, c.r, c.g, c.b);
                    colorAttr.setXYZ(s * 2 + 1, c.r, c.g, c.b);
                }
                colorAttr.needsUpdate = true;
            }
        }
        if (this.points) {
            const colorAttr = this.points.geometry.getAttribute('color') as THREE.BufferAttribute;
            if (colorAttr && this.basePointColors && this.basePointColors.length === colorAttr.count * 3) {
                const connected = new Set<number>();
                if (index !== null) {
                    for (const pair of this.linePairs) {
                        if (pair[0] === index) connected.add(pair[1]);
                        else if (pair[1] === index) connected.add(pair[0]);
                    }
                }
                for (let i = 0; i < colorAttr.count; i++) {
                    const r = this.basePointColors[i * 3];
                    const g = this.basePointColors[i * 3 + 1];
                    const b = this.basePointColors[i * 3 + 2];
                    if (connected.has(i)) {
                        colorAttr.setXYZ(i, Math.min(1, r + 0.55), Math.min(1, g + 0.55), Math.min(1, b + 0.55));
                    } else {
                        colorAttr.setXYZ(i, r, g, b);
                    }
                }
                colorAttr.needsUpdate = true;
            }
        }
    }

    private showTooltip(memory: any) {
        this.tooltip.innerHTML = `
            <div class="tooltip-title">Memory</div>
            <div class="tooltip-meta">${this.buildMemoryMeta(memory)}</div>
            <div class="tooltip-text">${this.highlightTerm(this.escapeHtml(memory.text || ''))}</div>
        `;
        this.tooltip.style.display = 'block';
        // Start each newly hovered memory at the top of its (scrollable) popup.
        this.tooltip.scrollTop = 0;
    }

    private highlightTerm(escapedText: string): string {
        if (!this.searchTerm) return escapedText;
        const escapedTerm = this.escapeHtml(this.searchTerm).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (!escapedTerm) return escapedText;
        try {
            return escapedText.replace(new RegExp(escapedTerm, 'gi'), (m) => `<mark>${m}</mark>`);
        } catch (e) {
            return escapedText;
        }
    }

    private hideTooltip() {
        this.tooltip.style.display = 'none';
    }

    private escapeHtml(str: string): string {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    private setupEditor() {
        const closeBtn = this.shadow.querySelector('#editor-close-btn');
        closeBtn?.addEventListener('click', () => this.hideEditor());
        const saveBtn = this.shadow.querySelector('#editor-save-btn') as HTMLButtonElement;
        saveBtn?.addEventListener('click', () => this.saveMemory());

        // Enable/disable the Save button based on whether the memory was edited.
        const text = this.shadow.querySelector('#editor-text') as HTMLTextAreaElement;
        const emotion = this.shadow.querySelector('#editor-emotion') as HTMLInputElement;
        const onEdit = () => this.updateSaveButtonState();
        text?.addEventListener('input', onEdit);
        emotion?.addEventListener('input', onEdit);

        // Make the editor dialog draggable via its title bar.
        const title = this.shadow.querySelector('.editor-title') as HTMLElement;
        title?.addEventListener('mousedown', (e) => this.startEditorDrag(e));
        window.addEventListener('mousemove', (e) => this.onEditorDrag(e));
        window.addEventListener('mouseup', () => this.stopEditorDrag());
    }

    /**
     * Wires up the bottom-middle search bar: reveal on hover, live match counting,
     * prev/next navigation, and keyboard handling. Input keydown stops propagation so
     * it never triggers the container's drag/click handlers.
     */
    private setupSearchBar() {
        const revealZone = this.shadow.querySelector('#search-reveal-zone') as HTMLDivElement;
        const bar = this.shadow.querySelector('#search-bar') as HTMLDivElement;
        const input = this.shadow.querySelector('#search-input') as HTMLInputElement;
        const counter = this.shadow.querySelector('#search-counter') as HTMLSpanElement;
        const prevBtn = this.shadow.querySelector('#search-prev') as HTMLButtonElement;
        const nextBtn = this.shadow.querySelector('#search-next') as HTMLButtonElement;
        const hint = this.shadow.querySelector('#search-hint') as HTMLDivElement;
        if (!bar || !input) return;

        // The always-visible hint tells users search exists; it hides while the bar is open.
        const show = () => { bar.classList.add('visible'); hint?.classList.add('hidden'); };
        const hide = () => {
            if (document.activeElement !== input) bar.classList.remove('visible');
            if (!bar.matches(':hover')) hint?.classList.remove('hidden');
        };

        revealZone?.addEventListener('mouseenter', show);
        bar.addEventListener('mouseenter', show);
        bar.addEventListener('mouseleave', hide);
        input.addEventListener('focus', show);
        input.addEventListener('blur', () => { if (!bar.matches(':hover')) { bar.classList.remove('visible'); hint?.classList.remove('hidden'); } });

        input.addEventListener('input', () => {
            this.searchTerm = input.value.trim();
            this.updateSearchMatches();
            if (this.searchMatches.length > 0) {
                this.searchCursor = 0;
                this.goToMatch(0);
            } else {
                this.searchCursor = -1;
            }
            this.updateSearchCounter(counter);
        });

        // Stop propagation so typing never rotates/pans the scene or picks nodes.
        input.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
                e.preventDefault();
                this.cycleMatch(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.cycleMatch(-1);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.clearSearch();
                bar.classList.remove('visible');
                input.blur();
            }
        });

        prevBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.cycleMatch(-1); });
        nextBtn?.addEventListener('click', (e) => { e.stopPropagation(); this.cycleMatch(1); });
    }

    /** Recomputes the list of memory indices matching the current search term. */
    private updateSearchMatches(): void {
        const term = this.searchTerm.toLowerCase();
        if (!term) { this.searchMatches = []; return; }
        this.searchMatches = [];
        this.memories.forEach((memory: any, i: number) => {
            const text = String(memory.text || '').toLowerCase();
            const name = this.getCharacterName(memory.characterId).toLowerCase();
            if (text.includes(term) || name.includes(term)) {
                this.searchMatches.push(i);
            }
        });
    }

    private updateSearchCounter(counter: HTMLSpanElement | null): void {
        if (!counter) return;
        const total = this.searchMatches.length;
        const current = total > 0 && this.searchCursor >= 0 ? this.searchCursor + 1 : 0;
        counter.textContent = `${current} / ${total}`;
    }

    /** Cycles the match cursor with wrap-around and navigates to the match. */
    private cycleMatch(delta: number): void {
        if (this.searchMatches.length === 0) return;
        const n = this.searchMatches.length;
        this.searchCursor = ((this.searchCursor + delta) % n + n) % n;
        this.goToMatch(this.searchCursor);
        const counter = this.shadow.querySelector('#search-counter') as HTMLSpanElement;
        this.updateSearchCounter(counter);
    }

    /** Selects the match, centers the camera on it, and shows the highlighted tooltip. */
    private goToMatch(cursor: number): void {
        const index = this.searchMatches[cursor];
        if (index === undefined || !this.memories[index]) return;
        this.autoRotate = false;
        this.setSelectedIndex(index);
        // Center the camera on the node's world position (accounting for scene rotation).
        const positionAttr = this.points?.geometry.getAttribute('position') as THREE.BufferAttribute;
        if (positionAttr) {
            const world = new THREE.Vector3(
                positionAttr.getX(index),
                positionAttr.getY(index),
                positionAttr.getZ(index)
            ).applyEuler(this.scene.rotation);
            this.camera.position.x = world.x;
            this.camera.position.y = world.y;
        }
        this.showTooltip(this.memories[index]);
    }

    private clearSearch(): void {
        this.searchTerm = '';
        this.searchMatches = [];
        this.searchCursor = -1;
        const input = this.shadow.querySelector('#search-input') as HTMLInputElement;
        if (input) input.value = '';
        const counter = this.shadow.querySelector('#search-counter') as HTMLSpanElement;
        this.updateSearchCounter(counter);
        this.setSelectedIndex(null);
        this.hideTooltip();
    }

    private showEditor(memory: any) {
        this.pinnedMemory = memory;
        const meta = this.shadow.querySelector('#editor-meta') as HTMLDivElement;
        if (meta) meta.innerHTML = this.buildMemoryMeta(memory);
        const text = this.shadow.querySelector('#editor-text') as HTMLTextAreaElement;
        if (text) text.value = memory.text || '';
        const emotion = this.shadow.querySelector('#editor-emotion') as HTMLInputElement;
        if (emotion) emotion.value = memory.emotion || '';
        const status = this.shadow.querySelector('#editor-status') as HTMLDivElement;
        if (status) { status.textContent = ''; status.className = 'editor-status'; }
        this.editor.classList.add('visible');
        this.updateSaveButtonState();
    }

    private hideEditor() {
        this.editor.classList.remove('visible');
        this.pinnedMemory = null;
        this.setSelectedIndex(null);
    }

    private async saveMemory() {
        if (!this.pinnedMemory) return;
        const text = (this.shadow.querySelector('#editor-text') as HTMLTextAreaElement)?.value || '';
        const emotion = (this.shadow.querySelector('#editor-emotion') as HTMLInputElement)?.value || '';
        const status = this.shadow.querySelector('#editor-status') as HTMLDivElement;
        try {
            const result = await ipcRenderer.invoke('update-memory', {
                id: this.pinnedMemory.id,
                text,
                emotion
            });
            if (result && result.success) {
                this.pinnedMemory.text = text;
                this.pinnedMemory.emotion = emotion;
                if (status) { status.textContent = 'Saved'; status.className = 'editor-status success'; }
                this.updateSaveButtonState();
            } else {
                if (status) { status.textContent = 'Save failed'; status.className = 'editor-status error'; }
            }
        } catch (err) {
            if (status) { status.textContent = 'Save error'; status.className = 'editor-status error'; }
        }
    }

    public setCharacterMap(map: Record<string, string>): void {
        this.characterMap = map || {};
    }

    private getCharacterName(characterId: string): string {
        if (!characterId) return 'Unknown';
        return this.characterMap[characterId] || `Character ${characterId}`;
    }

    private buildMemoryMeta(memory: any): string {
        const parts: string[] = [];
        const t = (k: string, d: string) => ((window as any).LocalizationManager?.getTranslation(k, d) ?? d);
        if (memory.characterId) {
            parts.push('Character: ' + this.escapeHtml(this.getCharacterName(memory.characterId)));
        }
        // Game Date: the in-game date when the memory was created (localized "Unknown"
        // for legacy memories predating game-date storage). Real Date/Time: wall clock.
        const gameDate = memory.gameDate || memory.date || '';
        parts.push(t('memory_constellation.game_date_label', 'Game Date: ') + this.escapeHtml(gameDate || t('memory_constellation.game_date_unknown', 'Unknown')));
        if (memory.timestamp) {
            parts.push(t('memory_constellation.real_date_label', 'Real Date/Time: ') + this.escapeHtml(new Date(memory.timestamp).toLocaleString()));
        }
        if (memory.emotion) {
            parts.push('Emotion: ' + this.escapeHtml(memory.emotion));
        }
        // Location is always rendered: "Letter"/"Diary" for letter/diary-sourced memories,
        // a localized scene name for scene memories, or a localized "Unknown" fallback.
        const sceneName = memory.scene === 'letter'
            ? t('memory_constellation.scene_letter', 'Letter')
            : memory.scene === 'diary'
                ? t('memory_constellation.scene_diary', 'Diary')
                : (memory.scene
                    ? t(`locations.${memory.scene}`, memory.scene)
                    : t('memory_constellation.location_unknown', 'Unknown'));
        parts.push(t('memory_constellation.location_label', 'Location: ') + this.escapeHtml(sceneName));
        return parts.join('<br>');
    }

    private updateSaveButtonState(): void {
        const saveBtn = this.shadow.querySelector('#editor-save-btn') as HTMLButtonElement;
        if (!saveBtn || !this.pinnedMemory) return;
        const text = (this.shadow.querySelector('#editor-text') as HTMLTextAreaElement)?.value || '';
        const emotion = (this.shadow.querySelector('#editor-emotion') as HTMLInputElement)?.value || '';
        const changed = text !== (this.pinnedMemory.text || '') || emotion !== (this.pinnedMemory.emotion || '');
        saveBtn.disabled = !changed;
    }

    private buildRelationLines(memories: any[], positions: Float32Array): void {
        if (memories.length < 2) return;
        const linePositions: number[] = [];
        const lineColors: number[] = [];
        const dim = { r: 0x5a / 255, g: 0x4a / 255, b: 0x35 / 255 };
        this.linePairs = [];
        for (let i = 0; i < memories.length; i++) {
            for (let j = i + 1; j < memories.length; j++) {
                const related = memories[i].characterId && memories[i].characterId === memories[j].characterId;
                if (related) {
                    linePositions.push(
                        positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
                        positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
                    );
                    // Per-vertex dim base colors so applyHoverHighlight can brighten
                    // individual segments on hover without a custom shader.
                    lineColors.push(dim.r, dim.g, dim.b, dim.r, dim.g, dim.b);
                    this.lineReasons.push(String(memories[i].characterId || ''));
                    this.linePairs.push([i, j]);
                }
            }
        }
        if (linePositions.length === 0) return;
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        lineGeo.setAttribute('color', new THREE.Float32BufferAttribute(lineColors, 3));
        const lineMat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.4 });
        this.lines = new THREE.LineSegments(lineGeo, lineMat);
        this.scene.add(this.lines);
    }

    private startEditorDrag(e: MouseEvent): void {
        if ((e.target as HTMLElement).id === 'editor-close-btn') return;
        this.editorDrag.dragging = true;
        this.editorDrag.startX = e.clientX;
        this.editorDrag.startY = e.clientY;
        this.editorDrag.origLeft = this.editor.offsetLeft;
        this.editorDrag.origTop = this.editor.offsetTop;
        e.preventDefault();
    }

    private onEditorDrag(e: MouseEvent): void {
        if (!this.editorDrag.dragging) return;
        const dx = e.clientX - this.editorDrag.startX;
        const dy = e.clientY - this.editorDrag.startY;
        this.editor.style.left = (this.editorDrag.origLeft + dx) + 'px';
        this.editor.style.top = (this.editorDrag.origTop + dy) + 'px';
        this.editor.style.right = 'auto';
    }

    private stopEditorDrag(): void {
        this.editorDrag.dragging = false;
    }

    updatePoints(memories: any[]) {
        const nextMemories = memories || [];

        // Skip redundant rebuilds: the 20s auto-refresh calls this constantly, but
        // when the dataset is unchanged we must not clear the ring/tooltip or touch
        // the scene (which would reset the user's view).
        const signature = JSON.stringify(nextMemories.map((m: any) => [m.id, m.timestamp, m.text ? m.text.length : 0]));
        if (signature === this.lastDataSignature) {
            return;
        }
        this.lastDataSignature = signature;

        // Preserve the user's view across real rebuilds.
        const savedRotation = { x: this.scene.rotation.x, y: this.scene.rotation.y, z: this.scene.rotation.z };
        const savedCamera = { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
        const previousSelectedIndex = this.selectedIndex;

        // Clear existing points
        while(this.scene.children.length > 0){ 
            this.scene.remove(this.scene.children[0]); 
        }
        this.hideTooltip();
        // Reset relation-line and selection state; buildRelationLines and the next
        // pick repopulate both for the new data.
        this.lines = null;
        this.lineReasons = [];
        this.linePairs = [];
        this.hoveredIndex = null;
        this.basePointColors = null;
        this.memories = nextMemories;
        this.selectedIndex = null;
        this.selectedRing = null;

        if (!nextMemories || nextMemories.length === 0) {
            this.emptyState.classList.add('visible');
            return;
        }

        this.emptyState.classList.remove('visible');

        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(nextMemories.length * 3);

        nextMemories.forEach((memory: any, i: number) => {
            // Deterministic projection of the embedding vector (Johnson-Lindenstrauss
            // style): unit-normalize the vector and dot it with 3 fixed orthonormal
            // basis vectors, scaled to the existing +/-5 range. Falls back to a hash
            // of the memory id when no vector is available, so the layout stays stable
            // across rebuilds even without embeddings.
            const p = this.projectMemory(memory);
            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;
        });

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        // Vertex colors: hue from emotion, brightness from recency.
        const colors = new Float32Array(nextMemories.length * 3);
        const timestamps = nextMemories.map((m: any) => m.timestamp || 0);
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);
        const tsRange = Math.max(1, maxTs - minTs);
        nextMemories.forEach((memory: any, i: number) => {
            const base = this.emotionColor(memory.emotion);
            const recency = ((memory.timestamp || 0) - minTs) / tsRange; // 0 = oldest, 1 = newest
            const brightness = 0.35 + 0.65 * recency;
            colors[i * 3] = base.r * brightness;
            colors[i * 3 + 1] = base.g * brightness;
            colors[i * 3 + 2] = base.b * brightness;
        });
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        // Snapshot the base (emotion) colors so the hover highlight can restore them.
        this.basePointColors = new Float32Array(colors);

        // Use a circular sprite texture so points render as glowing dots, not squares.
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.4, 'rgba(204, 164, 59, 1)');
        gradient.addColorStop(1, 'rgba(204, 164, 59, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        const texture = new THREE.CanvasTexture(canvas);

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            vertexColors: true,
            size: 0.35,
            map: texture,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true
        });
        this.points = new THREE.Points(geometry, material);
        this.scene.add(this.points);

        this.buildRelationLines(nextMemories, positions);

        // Restore the user's view and re-attach the selection ring for the still-valid
        // selected index (clear it only if the index is now out of range).
        this.scene.rotation.set(savedRotation.x, savedRotation.y, savedRotation.z);
        this.camera.position.set(savedCamera.x, savedCamera.y, savedCamera.z);
        if (previousSelectedIndex !== null && previousSelectedIndex < nextMemories.length) {
            this.setSelectedIndex(previousSelectedIndex);
        }
    }

    /**
     * Builds (once) a fixed orthonormal basis of 3 unit vectors used to project
     * embedding vectors into 3D. Uses a seeded PRNG + Gram-Schmidt so the basis is
     * deterministic across sessions and rebuilds.
     */
    private getProjectionBasis(): THREE.Vector3[] {
        if (this.projectionBasis) return this.projectionBasis;
        // Deterministic PRNG (mulberry32) seeded with a constant.
        let seed = 0x9e3779b9;
        const rand = () => {
            seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
            let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const basis: THREE.Vector3[] = [];
        for (let i = 0; i < 3; i++) {
            const v = new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5);
            // Gram-Schmidt against the already-accepted basis vectors.
            for (const b of basis) {
                v.sub(b.clone().multiplyScalar(v.dot(b)));
            }
            if (v.lengthSq() < 1e-6) { v.set(1, 0, 0); }
            v.normalize();
            basis.push(v);
        }
        this.projectionBasis = basis;
        return basis;
    }

    /**
     * Deterministic 3D position for a memory. Projects the (unit-normalized)
     * embedding vector onto the fixed basis, scaled to the +/-5 range. Falls back
     * to a hash of the memory id when no usable vector is present.
     */
    private projectMemory(memory: any): { x: number; y: number; z: number } {
        const SCALE = 5;
        const vec = memory && memory.vector;
        if (vec && vec.length > 0) {
            let norm = 0;
            for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
            norm = Math.sqrt(norm);
            if (norm > 1e-9) {
                const basis = this.getProjectionBasis();
                const out = [0, 0, 0];
                for (let b = 0; b < 3; b++) {
                    let dot = 0;
                    const bv = basis[b];
                    for (let i = 0; i < vec.length; i++) {
                        dot += (vec[i] / norm) * bv.getComponent(i % 3);
                    }
                    out[b] = dot;
                }
                return { x: out[0] * SCALE, y: out[1] * SCALE, z: out[2] * SCALE };
            }
        }
        // Fallback: deterministic position from a hash of the memory id.
        const id = String((memory && memory.id) || '');
        let h = 2166136261;
        for (let i = 0; i < id.length; i++) {
            h ^= id.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        const hx = ((h >>> 0) % 1000) / 1000 - 0.5;
        const hy = (((h >>> 10) >>> 0) % 1000) / 1000 - 0.5;
        const hz = (((h >>> 20) >>> 0) % 1000) / 1000 - 0.5;
        return { x: hx * 2 * SCALE, y: hy * 2 * SCALE, z: hz * 2 * SCALE };
    }

    private emotionColor(emotion: string): { r: number; g: number; b: number } {
        const e = (emotion || '').toLowerCase();
        if (/hap|joy|excit|grateful|love/.test(e)) return { r: 1.0, g: 0.8, b: 0.2 };
        if (/sad|grief|sorrow|melanch/.test(e)) return { r: 0.3, g: 0.5, b: 1.0 };
        if (/ang|rage|furi|hate/.test(e)) return { r: 1.0, g: 0.25, b: 0.2 };
        if (/fear|afraid|worried|anx|terrif/.test(e)) return { r: 0.6, g: 0.3, b: 0.9 };
        if (/calm|content|peace|serene/.test(e)) return { r: 0.3, g: 0.9, b: 0.6 };
        return { r: 0.8, g: 0.64, b: 0.23 }; // neutral gold
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