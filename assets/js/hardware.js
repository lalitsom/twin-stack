// State
const inventory = {
    'server': { type: 'hardware', name: 'Server Node', icon: 'fa-server', count: 5, ports: [], slots: ['pcie'] },
    'switch': { type: 'hardware', name: '24-Port Switch', icon: 'fa-network-wired', count: 3, ports: Array(8).fill('lan') }, // Simplified to 8 for UI
    'nic': { type: 'hardware', name: 'PCIe NIC', icon: 'fa-microchip', count: 10, ports: ['lan'], connector: 'pcie' },
    'nic2': { type: 'hardware', name: 'PCIe NIC 2', icon: 'fa-microchip', count: 10, ports: ['lan'], connector: 'pcie' },
    'cable_lan': { type: 'cable', name: 'Cat6 LAN Cable', icon: 'fa-ethernet', count: 20, cableType: 'lan' }
};

const components = []; // { id, type, x, y, element, ports: { id: { type, connectedTo } } }
const connections = []; // { id, sourcePortId, targetPortId, type, cableId }

let draggedItemType = null;
let activeCableType = null;
let sourcePort = null;
let tempLine = null; // SVG line for dragging

// DOM Elements
const inventoryList = document.getElementById('inventory-list');
const inventorySearch = document.getElementById('inventory-search');
const workspace = document.getElementById('workspace-container');
const componentLayer = document.getElementById('component-layer');
const cableLayer = document.getElementById('cable-layer');
const notificationArea = document.getElementById('notification-area');

// --- Initialization ---
function init() {
    renderInventory();
    setupGlobalEvents();
}

// --- Inventory System ---
function renderInventory() {
    const filter = inventorySearch ? inventorySearch.value.toLowerCase() : '';
    inventoryList.innerHTML = '';
    
    Object.entries(inventory).forEach(([key, item]) => {
        if (!item.name.toLowerCase().includes(filter)) return;

        const div = document.createElement('div');
        div.className = `inventory-item p-3 bg-white border border-gray-200 rounded shadow-sm flex items-center justify-between ${item.count === 0 ? 'disabled' : ''}`;
        div.draggable = item.count > 0 && item.type === 'hardware';
        div.dataset.type = key;
        
        div.innerHTML = `
            <div class="flex items-center">
                <div class="w-8 h-8 bg-blue-100 rounded flex items-center justify-center text-blue-600 mr-3">
                    <i class="fas ${item.icon}"></i>
                </div>
                <div>
                    <div class="font-medium text-gray-800">${item.name}</div>
                    <div class="text-xs text-gray-500 capitalize">${item.type}</div>
                </div>
            </div>
            <div class="bg-gray-100 px-2 py-1 rounded text-xs font-bold text-gray-600">x${item.count}</div>
        `;

        // Event Listeners
        if (item.type === 'hardware' && item.count > 0) {
            div.addEventListener('dragstart', (e) => {
                draggedItemType = key;
                e.dataTransfer.setData('text/plain', key);
                e.dataTransfer.effectAllowed = 'copy';
            });
        } else if (item.type === 'cable' && item.count > 0) {
            div.addEventListener('click', () => {
                activateCableTool(key);
            });
            if (activeCableType === key) {
                div.classList.add('ring-2', 'ring-blue-500');
            }
        }

        inventoryList.appendChild(div);
    });
}

function updateInventory(key, change) {
    if (inventory[key]) {
        inventory[key].count += change;
        renderInventory();
    }
}

function activateCableTool(key) {
    if (activeCableType === key) {
        activeCableType = null; // Toggle off
        cancelConnection();
    } else {
        activeCableType = key;
        showNotification(`Selected ${inventory[key].name}. Click a port to connect.`);
    }
    renderInventory();
}

function getTypeColor(type) {
    const colors = ['red', 'blue', 'green', 'purple', 'orange', 'teal', 'pink', 'indigo'];
    let hash = 0;
    for (let i = 0; i < type.length; i++) {
        hash = type.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

// --- Component Factory ---
function createComponent(type, x, y) {
    const data = inventory[type];
    if (!data || data.count <= 0) return;

    // Decrement inventory
    updateInventory(type, -1);

    const id = `comp_${Date.now()}`;
    const component = {
        id,
        type,
        x,
        y,
        ports: {}
    };

    const el = document.createElement('div');
    el.className = 'hw-component bg-white border border-gray-300 rounded shadow-sm p-2 flex flex-col items-center min-w-[120px]';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.id = id;

    // Header
    el.innerHTML = `
        <div class="w-full flex justify-between items-center mb-2 handle cursor-move bg-gray-50 p-1 rounded">
            <span class="text-xs font-bold text-gray-700 pointer-events-none"><i class="fas ${data.icon} mr-1"></i>${data.name}</span>
            <button class="text-gray-400 hover:text-red-500 text-xs" onclick="deleteComponent('${id}')"><i class="fas fa-times"></i></button>
        </div>
        <div class="w-full flex flex-wrap gap-2 justify-center ports-container"></div>
    `;

    // Render Ports/Slots
    const portsContainer = el.querySelector('.ports-container');
    
    // 1. Standard Ports (Female)
    if (data.ports) {
        data.ports.forEach((pType, idx) => {
            const portId = `${id}_p_${idx}`;
            const portEl = createPortElement(portId, pType, 'port');
            portsContainer.appendChild(portEl);
            component.ports[portId] = { id: portId, type: pType, role: 'port', parentId: id };
        });
    }

    // 2. Connector (Male - e.g. PCIe Card Edge)
    if (data.connector) {
        const pType = data.connector;
        const portId = `${id}_conn_${pType}`;
        const portEl = createPortElement(portId, pType, 'connector');
        portsContainer.appendChild(portEl);
        component.ports[portId] = { id: portId, type: pType, role: 'connector', parentId: id };
    }

    // 3. Slots (Female - Internal)
    if (data.slots) {
        data.slots.forEach((sType, idx) => {
            const slotId = `${id}_slot_${idx}`;
            const portEl = createPortElement(slotId, sType, 'slot');
            portsContainer.appendChild(portEl);
            component.ports[slotId] = { id: slotId, type: sType, role: 'slot', parentId: id };
        });
    }

    // Drag Logic
    setupDraggable(el, component);

    componentLayer.appendChild(el);
    component.element = el;
    components.push(component);
}

function createPortElement(id, type, role) {
    const div = document.createElement('div');
    div.id = id;
    div.className = `hw-port flex items-center justify-center border text-[9px] font-bold relative z-20 transition-all`;
    div.style.minWidth = '24px';
    div.style.height = '24px';
    div.style.padding = '0 4px';
    div.style.borderRadius = '4px';

    const color = getTypeColor(type);

    // Generic Styling based on Role & Dynamic Color
    if (role === 'connector') {
        // Male / Output (Light bg, Strong border)
        div.classList.add(`bg-${color}-100`, `border-${color}-500`, `text-${color}-900`, 'cursor-pointer');
        div.innerHTML = `${type.toUpperCase()}(c)`;
        div.title = `Click to Install (${type})`;
    } else if (role === 'slot') {
        // Female / Internal (Dark bg, Light text)
        div.classList.add(`bg-${color}-700`, `border-${color}-900`, 'text-white');
        div.innerHTML = `${type.toUpperCase()}(s)`;
        div.style.minWidth = '40px';
    } else {
        // Standard Port (Very light bg)
        div.classList.add(`bg-${color}-50`, `border-${color}-300`, `text-${color}-700`);
        div.innerHTML = type.toUpperCase();
        if (type === 'lan') div.innerHTML = '<i class="fas fa-network-wired"></i>';
    }

    div.addEventListener('click', (e) => {
        e.stopPropagation();
        handlePortClick(id);
    });

    return div;
}

// --- Drag & Drop ---
function setupGlobalEvents() {
    // Inventory Search
    if (inventorySearch) {
        inventorySearch.addEventListener('input', () => {
            renderInventory();
        });
    }

    workspace.addEventListener('dragover', (e) => {
        e.preventDefault(); // Allow drop
    });

    workspace.addEventListener('drop', (e) => {
        e.preventDefault();
        if (draggedItemType) {
            const rect = workspace.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            createComponent(draggedItemType, x, y);
            draggedItemType = null;
        }
    });

    // Cancel cable tool on escape or right click
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') cancelConnection();
    });
}

function setupDraggable(el, component) {
    let isDragging = false;
    let startX, startY;

    const handle = el.querySelector('.handle');
    
    handle.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX - el.offsetLeft;
        startY = e.clientY - el.offsetTop;
        el.classList.add('shadow-lg', 'z-50');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        
        const rect = workspace.getBoundingClientRect();
        let newX = e.clientX - startX;
        let newY = e.clientY - startY;

        // Bounds check
        newX = Math.max(0, Math.min(newX, rect.width - el.offsetWidth));
        newY = Math.max(0, Math.min(newY, rect.height - el.offsetHeight));

        el.style.left = `${newX}px`;
        el.style.top = `${newY}px`;
        component.x = newX;
        component.y = newY;

        updateCables(component);
    });

    window.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            el.classList.remove('shadow-lg', 'z-50');
        }
    });
}

// --- Cabling Logic ---
function handlePortClick(portId) {
    // Helper to find component/port data
    const comp = components.find(c => c.ports[portId]);
    const portData = comp.ports[portId]; // { id, type, role, ... }

    // If we have an active cable tool
    if (activeCableType) {
        if (!sourcePort) {
            // Select Source
            sourcePort = portData;
            document.getElementById(portId).classList.add('selected-source');
            startTempLine(portId);
        } else {
            if (portId === sourcePort.id) return; 
            completeConnection(portData);
        }
        return;
    } 

    // Special Case: Direct Installation (Click Connector -> Click Slot)
    if (portData.role === 'connector') {
        if (!sourcePort) {
            sourcePort = portData;
            document.getElementById(portId).classList.add('selected-source');
            startTempLine(portId);
            showNotification(`Select a matching ${portData.type.toUpperCase()} Slot.`);
            return;
        }
    } 
    
    if (sourcePort && sourcePort.role === 'connector') {
        // Finishing an installation (Source was a connector)
        completeConnection(portData);
        return;
    }
    
    showNotification("Select a cable or click a Connector to install.");
}

function startTempLine(portId) {
    const portEl = document.getElementById(portId);
    const rect = workspace.getBoundingClientRect();
    const pRect = portEl.getBoundingClientRect();
    
    const x1 = pRect.left + pRect.width / 2 - rect.left;
    const y1 = pRect.top + pRect.height / 2 - rect.top;

    tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    tempLine.setAttribute('x1', x1);
    tempLine.setAttribute('y1', y1);
    tempLine.setAttribute('x2', x1);
    tempLine.setAttribute('y2', y1);
    
    const typeClass = activeCableType ? inventory[activeCableType].cableType : 'pcie';
    tempLine.setAttribute('class', `cable-line cable-${typeClass}`);
    tempLine.style.strokeDasharray = "5,5"; // Dashed for temp
    
    cableLayer.appendChild(tempLine);

    const onMove = (e) => {
        if (!sourcePort) {
            window.removeEventListener('mousemove', onMove);
            return;
        }
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        tempLine.setAttribute('x2', mx);
        tempLine.setAttribute('y2', my);
    };

    window.addEventListener('mousemove', onMove);
}

function completeConnection(targetPortData) {
    const sourceEl = document.getElementById(sourcePort.id);
    const targetEl = document.getElementById(targetPortData.id);

    // Case 1: Direct Installation (Connector -> Slot)
    if (!activeCableType) {
        // Check Role Compatibility: Connector -> Slot
        // Check Type Compatibility: e.g. 'pcie' === 'pcie'
        if (sourcePort.role === 'connector' && targetPortData.role === 'slot' && sourcePort.type === targetPortData.type) {
             const connId = `conn_${Date.now()}`;
             connections.push({
                 id: connId,
                 source: sourcePort.id,
                 target: targetPortData.id,
                 type: sourcePort.type, // Use the component type as connection type
                 cableRef: null
             });
             
             sourceEl.classList.add('connected');
             targetEl.classList.add('connected');
             drawPermanentLine(connId, sourcePort.id, targetPortData.id, 'pcie'); // Use default purple style
             showNotification(`${sourcePort.type.toUpperCase()} Connected!`);
             cancelConnection();
             return;
        } else {
             showError(`Invalid: Cannot connect ${sourcePort.type}(c) to ${targetPortData.type}(${targetPortData.role === 'slot' ? 's' : '?'})`);
             cancelConnection();
             return;
        }
    }

    // Case 2: Using a Cable from Inventory
    const cableData = inventory[activeCableType];
    
    // 1. Check Cable Count
    if (cableData.count <= 0) {
        showError("Out of cables!");
        cancelConnection();
        return;
    }

    // 2. Check Port Compatibility
    // Generic Rule: Cable Type must match Port Type AND Ports must be 'port' role (usually)
    // For now, simple check:
    if (sourcePort.type !== cableData.cableType || targetPortData.type !== cableData.cableType) {
        showError(`Mismatch: Cable (${cableData.cableType}) vs Ports (${sourcePort.type}/${targetPortData.type})`);
        cancelConnection();
        return;
    }

    // 3. Create Connection
    const connId = `conn_${Date.now()}`;
    connections.push({
        id: connId,
        source: sourcePort.id,
        target: targetPortData.id,
        type: cableData.cableType,
        cableRef: activeCableType
    });

    // Update UI
    updateInventory(activeCableType, -1);
    sourceEl.classList.add('connected');
    targetEl.classList.add('connected');
    
    drawPermanentLine(connId, sourcePort.id, targetPortData.id, cableData.cableType);

    showNotification("Connected successfully!");
    cancelConnection(); // Reset tool
}

function drawPermanentLine(connId, p1Id, p2Id, type) {
    const p1El = document.getElementById(p1Id);
    const p2El = document.getElementById(p2Id);
    const rect = workspace.getBoundingClientRect();
    const r1 = p1El.getBoundingClientRect();
    const r2 = p2El.getBoundingClientRect();

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.id = connId;
    line.setAttribute('x1', r1.left + r1.width / 2 - rect.left);
    line.setAttribute('y1', r1.top + r1.height / 2 - rect.top);
    line.setAttribute('x2', r2.left + r2.width / 2 - rect.left);
    line.setAttribute('y2', r2.top + r2.height / 2 - rect.top);
    line.setAttribute('class', `cable-line cable-${type}`);
    
    // Double click to delete
    line.addEventListener('dblclick', () => deleteConnection(connId));

    cableLayer.appendChild(line);
}

function updateCables(component) {
    // Find all connections involving this component's ports
    const portIds = Object.keys(component.ports);
    
    connections.forEach(conn => {
        if (portIds.includes(conn.source) || portIds.includes(conn.target)) {
            const line = document.getElementById(conn.id);
            if (!line) return;

            const p1 = document.getElementById(conn.source);
            const p2 = document.getElementById(conn.target);
            const rect = workspace.getBoundingClientRect();
            const r1 = p1.getBoundingClientRect();
            const r2 = p2.getBoundingClientRect();

            line.setAttribute('x1', r1.left + r1.width / 2 - rect.left);
            line.setAttribute('y1', r1.top + r1.height / 2 - rect.top);
            line.setAttribute('x2', r2.left + r2.width / 2 - rect.left);
            line.setAttribute('y2', r2.top + r2.height / 2 - rect.top);
        }
    });
}

function cancelConnection() {
    if (sourcePort) {
        document.getElementById(sourcePort.id).classList.remove('selected-source');
        sourcePort = null;
    }
    if (tempLine) {
        tempLine.remove();
        tempLine = null;
    }
    // Keep activeCableType active for multiple connections? 
    // User flow: Select cable -> connect A-B -> tool stays active? 
    // Let's keep it active.
}

function deleteConnection(id) {
    const idx = connections.findIndex(c => c.id === id);
    if (idx > -1) {
        const conn = connections[idx];
        
        // Return cable to inventory (if it was a cable)
        if (conn.cableRef) {
            updateInventory(conn.cableRef, 1);
        }
        
        // Remove line
        document.getElementById(id).remove();
        
        // Update ports
        // Check if ports have other connections? (In this simple model, 1 cable per port usually)
        // Ideally we check counts. For visualization, remove 'connected' class if no other connections.
        const srcHasOthers = connections.some(c => c.id !== id && (c.source === conn.source || c.target === conn.source));
        const tgtHasOthers = connections.some(c => c.id !== id && (c.source === conn.target || c.target === conn.target));
        
        if (!srcHasOthers) document.getElementById(conn.source).classList.remove('connected');
        if (!tgtHasOthers) document.getElementById(conn.target).classList.remove('connected');

        connections.splice(idx, 1);
    }
}

// --- Utils ---
function showNotification(msg) {
    notificationArea.innerHTML = `<div class="bg-blue-600 text-white px-4 py-2 rounded shadow-lg animate-fade-in-down">${msg}</div>`;
    setTimeout(() => notificationArea.innerHTML = '', 3000);
}

function showError(msg) {
    notificationArea.innerHTML = `<div class="bg-red-600 text-white px-4 py-2 rounded shadow-lg animate-shake">${msg}</div>`;
    setTimeout(() => notificationArea.innerHTML = '', 3000);
}

function deleteComponent(id) {
    const compIdx = components.findIndex(c => c.id === id);
    if (compIdx === -1) return;

    // Remove all connections
    const comp = components[compIdx];
    const portIds = Object.keys(comp.ports);
    
    // Find connections to delete
    const connsToDelete = connections.filter(c => portIds.includes(c.source) || portIds.includes(c.target));
    connsToDelete.forEach(c => deleteConnection(c.id));

    // Return hardware to inventory
    updateInventory(comp.type, 1);

    // Remove DOM
    document.getElementById(id).remove();
    components.splice(compIdx, 1);
}

// Initialize
init();
