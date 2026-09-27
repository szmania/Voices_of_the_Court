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
            const dx = e.clientX - this.mouseDownPos.x;
            const dy = e.clientY - this.mouseDownPos.y;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return; // was a drag, not a click
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
                    this.showEditor(this.memories[index]);
                }
            }
        });

        // Double-click a node opens the same editor popup (same raycast + drag guard as click).
        this.container.addEventListener('dblclick', (e) => {
            const dx = e.clientX - this.mouseDownPos.x;
            const dy = e.clientY - this.mouseDownPos.y;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) return; // was a drag, not a click
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
                    this.showEditor(this.memories[index]);
                }
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
        } else if (this.lines && this.lineReasons.length > 0) {
            // No node hit — try relation-line hover so the user can read WHY a link exists.
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
            this.hideTooltip();
        }
    }
    private showTooltip(memory: any) {
        this.tooltip.innerHTML = `
            <div class="tooltip-title">Memory</div>
            <div>${this.escapeHtml(memory.text || '')}</div>
            <div class="tooltip-meta">${this.buildMemoryMeta(memory)}</div>
        `;
        this.tooltip.style.display = 'block';
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
        if (memory.characterId) {
            parts.push('Character: ' + this.escapeHtml(this.getCharacterName(memory.characterId)));
        }
        if (memory.timestamp) {
            parts.push('Date: ' + this.escapeHtml(new Date(memory.timestamp).toLocaleString()));
        }
        if (memory.emotion) {
            parts.push('Emotion: ' + this.escapeHtml(memory.emotion));
        }
        // Location is always rendered: localized scene name, "Letter" for letter-sourced
        // memories, or a localized "Unknown" fallback when the scene is empty.
        const t = (k: string, d: string) => ((window as any).LocalizationManager?.getTranslation(k, d) ?? d);
        const sceneName = memory.scene === 'letter'
            ? t('memory_constellation.scene_letter', 'Letter')
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
        for (let i = 0; i < memories.length; i++) {
            for (let j = i + 1; j < memories.length; j++) {
                const related = memories[i].characterId && memories[i].characterId === memories[j].characterId;
                if (related) {
                    linePositions.push(
                        positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2],
                        positions[j * 3], positions[j * 3 + 1], positions[j * 3 + 2]
                    );
                    this.lineReasons.push(String(memories[i].characterId || ''));
                }
            }
        }
        if (linePositions.length === 0) return;
        const lineGeo = new THREE.BufferGeometry();
        lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
        const lineMat = new THREE.LineBasicMaterial({ color: 0x5a4a35, transparent: true, opacity: 0.4 });
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
        // Clear existing points
        while(this.scene.children.length > 0){ 
            this.scene.remove(this.scene.children[0]); 
        }
        this.hideTooltip();
        // Reset relation-line state; buildRelationLines repopulates both for the new data.
        this.lines = null;
        this.lineReasons = [];
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

        // Vertex colors: hue from emotion, brightness from recency.
        const colors = new Float32Array(memories.length * 3);
        const timestamps = memories.map((m: any) => m.timestamp || 0);
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);
        const tsRange = Math.max(1, maxTs - minTs);
        memories.forEach((memory: any, i: number) => {
            const base = this.emotionColor(memory.emotion);
            const recency = ((memory.timestamp || 0) - minTs) / tsRange; // 0 = oldest, 1 = newest
            const brightness = 0.35 + 0.65 * recency;
            colors[i * 3] = base.r * brightness;
            colors[i * 3 + 1] = base.g * brightness;
            colors[i * 3 + 2] = base.b * brightness;
        });
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

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

        this.buildRelationLines(memories, positions);
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