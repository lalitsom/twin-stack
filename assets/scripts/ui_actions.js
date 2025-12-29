// --- UI ELEMENT REFERENCES ---
const toggleBtn = document.getElementById('toggle-controls-btn');
const closeBtn = document.getElementById('close-controls-btn');
const controlPanel = document.getElementById('control-panel');
const animationToggle = document.getElementById('animation-toggle');
const playgroundToggle = document.getElementById('playground-toggle');
const userCountInput = document.getElementById('user-count');
const applyBtn = document.getElementById('apply-btn');

const slider = document.getElementById("user-slider");
const valueSpan = document.getElementById("user-slider-value");

const infoBtn = document.getElementById('info-btn');
const closeStackInfoBtn = document.getElementById('close-stack-info-btn');
const stackInfoPanel = document.getElementById('stack-info-panel');
const stackInfoPanelContent = document.getElementById('stack-info-panel-content');

function updateControlPanel(root) {
    // Get all nodes from the hierarchy
    const allNodes = root.descendants();

    // Populate parent dropdown (can't add to a pod)
    const potentialParents = allNodes.filter(d => d.data.type !== 'pod');
    parentNodeSelect.innerHTML = potentialParents
        .map(d => `<option value="${d.data.name}">${d.data.name} (${d.data.type})</option>`)
        .join('');

    // Populate remove dropdown (can't remove the root load balancer)
    const removableNodes = allNodes.filter(d => d.depth > 0);
    removeNodeSelect.innerHTML = removableNodes
        .map(d => `<option value="${d.data.name}">${d.data.name}</option>`)
        .join('');
}


toggleBtn.addEventListener('click', () => {
    controlPanel.classList.toggle('hidden');
});

closeBtn.addEventListener('click', () => {
    controlPanel.classList.add('hidden');
});

animationToggle.addEventListener('change', () => {
    isAnimationEnabled = animationToggle.checked;
    treeData = stack.root;
    update(treeData); // Redraw to apply the change
});

playgroundToggle.addEventListener('change', () => {
    isPlaygroundModeEnabled = playgroundToggle.checked;
});

infoBtn.addEventListener('click', () => {
    stackInfoPanel.classList.toggle('hidden');
    if (!stackInfoPanel.classList.contains('hidden')) {
        updateStackInfoPanel();
    }
});

closeStackInfoBtn.addEventListener('click', () => {
    stackInfoPanel.classList.add('hidden');
});

function updateStackInfoPanel() {
    const stats = window.stack.metadata.stats;
    if (stats) {
        const content = `
            <p><strong>Stack Name:</strong> ${window.stack.stack_name}</p>
            <p><strong>Timestamp:</strong> ${new Date(stats.timestamp).toLocaleString()}</p>
            <p><strong>Max RPS:</strong> ${parseInt(stats.max_rps)}</p>
            <p><strong>Max TPS:</strong> ${parseInt(stats.max_tps)}</p>
            <p><strong>Daily Requests:</strong> ${parseInt(stats.daily_requests)}</p>
            <p><strong>Daily Txns:</strong> ${parseInt(stats.daily_txns)}</p>
            <p><strong>Daily Cost:</strong> ${parseInt(stats.daily_cost)}</p>
            <p><strong>Cost per Txn(Rs):</strong> ${(parseInt(stats.daily_cost) / parseInt(stats.daily_txns)).toFixed(4)}</p>
        `;
        stackInfoPanelContent.innerHTML = content;
    } else {
        stackInfoPanelContent.innerHTML = '<p>No stack stats available.</p>';
    }
}

const container = document.getElementById("navbar");


function deduplicate(node, cache = new Map()) {
    if (cache.has(node.name)) {
        return cache.get(node.name);
    }

    cache.set(node.name, node);
    node.children = node.children.map(child => deduplicate(child, cache));
    return node;
}


let stacksData = {};

async function loadStackAndDateOptions() {
    try {
        const response = await fetch('/api/stacks');
        stacksData = await response.json();
        
        const stackDropdown = document.getElementById("stack-dropdown");
        stackDropdown.innerHTML = ""; 

        const stackNames = Object.keys(stacksData);
        stackNames.forEach(stackName => {
            const li = document.createElement("li");
            li.textContent = stackName;
            li.className = "px-3 py-1 hover:bg-blue-500 hover:text-white cursor-pointer text-sm";
            li.addEventListener("click", () => {
                document.getElementById("stack-search").value = stackName;
                stackDropdown.classList.add("hidden");
                populateDateOptions(stackName);
                
                const dateSelect = document.getElementById("date-select");
                if (dateSelect.options.length > 1) { // more than "Select a date"
                    const firstDate = dateSelect.options[1].value;
                    dateSelect.value = firstDate;
                    handleStackSelection(stackName, firstDate);
                }
            });
            stackDropdown.appendChild(li);
        });

        // Automatically select the first stack and date
        if (stackNames.length > 0) {
            const firstStack = stackNames[0];
            document.getElementById("stack-search").value = firstStack;
            populateDateOptions(firstStack);
            
            const dateSelect = document.getElementById("date-select");
            if (dateSelect.options.length > 1) { // more than "Select a date"
                const firstDate = dateSelect.options[1].value;
                dateSelect.value = firstDate;
                handleStackSelection(firstStack, firstDate);
            }
        }
    } catch (error) {
        console.error('Error loading stack options:', error);
    }
}

function populateDateOptions(stackName) {
    const dateSelect = document.getElementById("date-select");
    const dates = stacksData[stackName] || [];
    
    dateSelect.innerHTML = '<option>Select a date</option>'; 
    
    dates.forEach(date => {
        const option = document.createElement("option");
        option.value = date;
        option.textContent = date;
        dateSelect.appendChild(option);
    });
    
    dateSelect.disabled = dates.length === 0;
}


async function handleStackSelection(stackName, date) {
    if (!stackName || !date) return;

    try {
        const response = await fetch(`/api/data?stack=${stackName}&date=${date}`);
        const data = await response.text();
    
        eval(data);
        window.stack = stack;
        
        if (window.stack) {
            update_state(window.stack);
            centerAndZoom();
        } else {
            console.error('Loaded data does not define window.stack');
        }

    } catch (error) {
        console.error('Error fetching stack data:', error);
    }
}

document.getElementById("date-select").addEventListener("change", (e) => {
    const selectedDate = e.target.value;
    const selectedStack = document.getElementById("stack-search").value;
    handleStackSelection(selectedStack, selectedDate);
});


const input = document.getElementById("stack-search");
const dropdown = document.getElementById("stack-dropdown");

input.addEventListener("focus", () => {
    dropdown.classList.remove("hidden");
});

input.addEventListener("input", () => {
    const val = input.value.toLowerCase();
    Array.from(dropdown.children).forEach(li => {
        li.style.display = li.textContent.toLowerCase().includes(val) ? "block" : "none";
    });
});


document.addEventListener("click", (e) => {
    if (!e.target.closest("#stack-search") && !e.target.closest("#stack-dropdown")) {
        dropdown.classList.add("hidden");
    }
});

function getIconName(m_type) {
    switch (m_type) {
        case "CLOUD_SQL_INSTANCE": return "db";
        case "READ_REPLICA_INSTANCE": return "db";
        case "K8_cluster": return "cluster";
        case "pods": return "cluster";
        default: return m_type;
    }
}

function checkNegative(val){
    if (val<0){
        return "NA";
    }
    return val;

}

document.getElementById('add-btn').addEventListener('click', () => {
    const componentNameInput = document.getElementById('component-name');
    const name = componentNameInput.value;

    if (!name) {
        alert('Please enter a name for the new component.');
        return;
    }

    if (window.stack) {
        if (!window.stack.nodes) {
            window.stack.nodes = [];
        }

        const nodeExists = window.stack.nodes.some(node => node.name === name);
        if (nodeExists) {
            alert('A node with this name already exists.');
            return;
        }

        // a default type, since none is specified
        const newNode = { name, count: 1, capabilities: [], action_flows: [], metadata: {type: "compute"} };
        console.log(newNode);
        window.stack.nodes.push(newNode);
        
        // Reset input and re-render
        componentNameInput.value = '';
        update_state(window.stack);
    } else {
        alert('No stack loaded to add a node to.');
    }
});

loadStackAndDateOptions();

document.getElementById('download-stack-btn').addEventListener('click', () => {
    if (window.stack) {
        const stackName = document.getElementById('stack-search').value;
        const date = document.getElementById('date-select').value;
        const fileName = `${stackName}_${date}.js`;

        const stackJson = JSON.stringify(window.stack, null, 2);
        const blob = new Blob([`var stack = ${stackJson};`], { type: 'application/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } else {
        alert('No stack data loaded to download.');
    }
});
