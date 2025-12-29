// --- GLOBAL STATE ---
let isAnimationEnabled = false;
let isPlaygroundModeEnabled = false;
const transition_duration = 50; // milliseconds
let animated_balls_count = 3;

// --- D3 SETUP ---
const margin = { top: 50, right: 120, bottom: 50, left: 120 };
const width = window.innerWidth;
const height = window.innerHeight;

const zoom = d3.zoom().on("zoom", (event) => {
    g.attr("transform", event.transform);
});

const svg = d3.select("#visualization")
    .attr("width", width)
    .attr("height", height)
    .call(zoom);

const g = svg.append("g");
const linkGroup = g.append('g').attr('class', 'link-group');
const nodeGroup = g.append('g').attr('class', 'node-group');

// --- DATA PROCESSING (NEW) ---
function flattenGraph(data) {
    const nodesMap = new Map();
    const links = [];

    // New format: data is an object with a 'nodes' array
    if (data && Array.isArray(data.nodes)) {
        const allNodes = data.nodes;

        allNodes.forEach(node => {
            nodesMap.set(node.name, { ...node, level: 0, children: undefined, parents: new Set() });
        });

        allNodes.forEach(node => {
            if (node.action_flows) {
                node.action_flows.forEach(flow => {
                    if (flow.actions) {
                        flow.actions.forEach(action => {
                            if (action.target_node) {
                                links.push({ source: node.name, target: action.target_node });
                            }
                        });
                    }
                });
            }
        });
        const nodes = Array.from(nodesMap.values());
        return { nodes, links };
    }


    const nodes = Array.from(nodesMap.values());
    return { nodes, links };
}


function getUtilization(nodeData, key) {
    if (nodeData.meta) {
        return !isNaN(nodeData.meta[key]) ? Math.ceil(nodeData.meta[key]) : "N/A";
    }
    return "N/A";
}


// --- CORE UPDATE FUNCTION (REFACTORED) ---
function update(sourceData) {
    const { nodes, links } = flattenGraph(sourceData);
    const nodesByName = new Map(nodes.map(n => [n.name, n]));
    const nodeWidth = 400;
    const nodeHeight = 250;

    // 2. POSITION NODES WITH DAGRE
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setGraph({
        rankdir: 'LR',
        nodesep: 150, // horizontal separation
        ranksep: 300  // vertical separation
    });
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    nodes.forEach(node => {
        dagreGraph.setNode(node.name, { label: node.name, width: nodeWidth, height: nodeHeight });
    });

    links.forEach(link => {
        dagreGraph.setEdge(link.source, link.target);
    });

    dagre.layout(dagreGraph);

    dagreGraph.nodes().forEach(nodeName => {
        const node = nodesByName.get(nodeName);
        const dagreNode = dagreGraph.node(nodeName);
        node.x = dagreNode.x;
        node.y = dagreNode.y;
    });

    // Assign colors to nodes.
    // If a node has multiple parents, each parent should have a different color.
    // This is achieved by giving each node a unique color based on its level and position within the level.
    const nodesByLevel = d3.group(nodes, d => d.level);
    const colorScale = d3.scaleOrdinal(d3.schemeTableau10);
    nodesByLevel.forEach((levelNodes, level) => {
        levelNodes.forEach((node, i) => {
            node.color = colorScale(`${level}-${i}`);
        });
    });


    // 3. RENDER LINKS
    const linkGenerator = d3.linkHorizontal()
        .x(d => d.x + margin.left)
        .y(d => d.y + margin.top);

    const linkData = links.map(link => {
        const sourceNode = nodesByName.get(link.source);
        const targetNode = nodesByName.get(link.target);
        return { source: sourceNode, target: targetNode };
    }).filter(d => d.source && d.target);


    linkGroup.selectAll('.link')
        .data(linkData, d => `${d.source.name}-${d.target.name}`)
        .join(
            enter => enter.append('path')
                .attr('class', 'link')
                .style('stroke', d => d.source.color) // Color the link
                .attr('d', d => {
                    const source = { x: d.source.x, y: d.source.y };
                    const target = { x: d.target.x, y: d.target.y };
                    const path = d3.path();
                    path.moveTo(source.x + margin.left, source.y + margin.top);
                    path.bezierCurveTo(
                        (source.x + target.x) / 2 + margin.left, source.y + margin.top,
                        (source.x + target.x) / 2 + margin.left, target.y + margin.top,
                        target.x + margin.left, target.y + margin.top
                    );
                    return path.toString();
                })
                .style('opacity', 0)
                .transition().duration(transition_duration)
                .style('opacity', 1),
            update => update
                .style('stroke', d => d.source.color) // Also update color on update
                .transition().duration(transition_duration)
                .attr('d', d => {
                    const source = { x: d.source.x, y: d.source.y };
                    const target = { x: d.target.x, y: d.target.y };
                    const path = d3.path();
                    path.moveTo(source.x + margin.left, source.y + margin.top);
                    path.bezierCurveTo(
                        (source.x + target.x) / 2 + margin.left, source.y + margin.top,
                        (source.x + target.x) / 2 + margin.left, target.y + margin.top,
                        target.x + margin.left, target.y + margin.top
                    );
                    return path.toString();
                }),
            exit => exit
                .transition().duration(transition_duration)
                .style('opacity', 0)
                .remove()
        );


    // 4. RENDER NODES
    const node = nodeGroup.selectAll('.node')
        .data(nodes, d => d.name);

    const nodeEnter = node.enter().append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.x + margin.left}, ${d.y + margin.top})`)
        .style('opacity', 0);

    // make more general
    function render_node(d) {
        const nodeData = d;
        let capabilitiesHtml = '';
        if (nodeData.capabilities) {
            nodeData.capabilities.forEach(cap => {
                if (!(cap.util+10)){
                    console.log(nodeData, "this")
                    console.log(cap, "and this")
                }
                capabilitiesHtml += `<div>${cap.name}: ${cap.capacity} (${checkNegative(cap.util.toFixed(2))}%)</div>`;
            });
        }

        return `
            <div class="bg-white shadow-lg rounded-lg p-4 w-full h-full border-4" style="position: relative; border-color: ${nodeData.color};">
                <div class="flex justify-between items-center">
                    <div class="flex items-center node-head">
                        <img src="assets/icons/${getIconName(nodeData.metadata.type)}.svg" class="w-8 h-8 mr-2">
                        <div class="font-bold">${nodeData.name}</div>
                    </div>
                </div>
                <div class="mt-2 node-info">
                    ${capabilitiesHtml}
                </div>
                <div class="absolute top-2 right-2 bg-blue-500 text-white rounded-full px-2 py-1">${nodeData.count}</div>
            </div>
        `;
    }

    nodeEnter.append('foreignObject')
        .attr('width', nodeWidth)
        .attr('height', nodeHeight)
        .attr('x', -nodeWidth / 2)
        .attr('y', -nodeHeight / 2)
        .html(d => render_node(d))
        .on('click', (event, d) => update_specs(d));


    nodeEnter.transition().duration(transition_duration).style('opacity', 1);

    node.transition().duration(transition_duration)
        .attr('transform', d => `translate(${d.x + margin.left}, ${d.y + margin.top})`);

    node.select('foreignObject')
        .html(d => render_node(d));

    node.exit().transition().duration(transition_duration)
        .style('opacity', 0)
        .remove();

    // 5. ANIMATE LINKS
    if (isAnimationEnabled) {
        let animationGroup = g.select('.animation-group');
        if (animationGroup.empty()) {
            animationGroup = g.insert('g', '.node-group').attr('class', 'animation-group');
        }
        animateLinks(linkData, animationGroup);
    } else {
        g.select('.animation-group').remove();
    }
}
function update_specs(d) {
    const infoPanel = document.getElementById('info-panel');
    const infoPanelContent = document.getElementById('info-panel-content');
    let content = '<form id="node-edit-form" class="space-y-4">';

    // Basic fields
    content += `
        <div>
            <label for="name" class="block text-sm font-medium text-gray-700">Name:</label>
            <input type="text" id="name" name="name" value="${d.name}" class="mt-1 p-2 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md">
        </div>
        <div>
            <label for="count" class="block text-sm font-medium text-gray-700">Count:</label>
            <input type="number" id="count" name="count" value="${d.count}" class="mt-1 p-2 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md">
        </div>
    `;

    // Capabilities
    content += '<h3 class="text-lg font-semibold border-t pt-4 mt-4">Capabilities</h3>';
    d.capabilities.forEach((cap, index) => {
        content += `
            <div class="p-2 border rounded space-y-2">
                <label class="block text-sm font-medium text-gray-700">Name: <input type="text" name="cap_name_${index}" value="${cap.name}" class="p-1 w-full border rounded"></label>
                <label class="block text-sm font-medium text-gray-700">Capacity: <input type="number" name="cap_capacity_${index}" value="${cap.capacity}" class="p-1 w-full border rounded"></label>
                <label class="block text-sm font-medium text-gray-700">Type: <select name="cap_type_${index}" class="p-1 w-full border rounded">
                    <option value="ephemeral" ${cap.type === 'ephemeral' ? 'selected' : ''}>Ephemeral</option>
                    <option value="persistent" ${cap.type === 'persistent' ? 'selected' : ''}>Persistent</option>
                </select></label>
                <button type="button" class="delete-capability text-sm text-red-500" data-index="${index}">Delete</button>
            </div>
        `;
    });
    content += '<button type="button" id="add-capability" class="text-sm text-blue-500">Add Capability</button>';

    // Action Flows
    content += '<h3 class="text-lg font-semibold border-t pt-4 mt-4">Action Flows</h3>';
    if (d.action_flows) {
        d.action_flows.forEach((flow, flowIndex) => {
            content += `
                <div class="p-2 border rounded space-y-2">
                    <label class="block text-sm font-medium text-gray-700">Name: <input type="text" name="flow_name_${flowIndex}" value="${flow.name}" class="p-1 w-full border rounded"></label>
                    <label class="block text-sm font-medium text-gray-700">Weight: <input type="number" name="flow_weight_${flowIndex}" value="${flow.weight}" class="p-1 w-full border rounded"></label>
                    <label><input type="checkbox" name="flow_self_initiated_${flowIndex}" ${flow.self_initiated ? 'checked' : ''}> Self Initiated</label>
                    <h4 class="font-semibold">Actions:</h4>
            `;
            flow.actions.forEach((action, actionIndex) => {
                let options = window.stack.nodes
                    .filter(n => n.name !== d.name)
                    .map(n => `<option value="${n.name}" ${action.target_node === n.name ? 'selected' : ''}>${n.name}</option>`)
                    .join('');
                content += `
                    <div class="p-1 border rounded space-y-1 ml-4">
                        <label class="block text-sm font-medium text-gray-700">Target Node: <select name="action_target_${flowIndex}_${actionIndex}" class="p-1 w-full border rounded">${options}</select></label>
                        <label class="block text-sm font-medium text-gray-700">Count: <input type="number" name="action_count_${flowIndex}_${actionIndex}" value="${action.count}" class="p-1 w-full border rounded"></label>
                        <button type="button" class="delete-action text-sm text-red-500" data-flow-index="${flowIndex}" data-action-index="${actionIndex}">Delete</button>
                    </div>
                `;
            });
            content += `<button type="button" class="add-action text-sm text-blue-500" data-flow-index="${flowIndex}">Add Action</button>`;
            
            content += `<h4 class="font-semibold">Capabilities Utilization:</h4>`;
            d.capabilities.forEach(cap => {
                const util = flow.capabilities_utilization && flow.capabilities_utilization[cap.name] ? flow.capabilities_utilization[cap.name] : 0;
                content += `
                    <label class="block text-sm font-medium text-gray-700">${cap.name}: 
                        <input type="number" name="cap_util_${flowIndex}_${cap.name}" value="${util}" class="p-1 w-full border rounded">
                    </label>
                `;
            });

            content += `</div><button type="button" class="delete-flow text-sm text-red-500" data-flow-index="${flowIndex}">Delete Flow</button>`;
        });
    }
    content += '<br><button type="button" id="add-action-flow" class="text-sm text-blue-500">Add Action Flow</button>';


    // Submit button
    if (isPlaygroundModeEnabled) {
        content += '<button type="submit" class="w-full bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mt-4">Apply</button>';
        content += '<button type="button" id="delete-node" class="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded mt-2">Delete Node</button>';
    } else {
        content += '<button type="submit" class="w-full bg-gray-400 text-white font-bold py-2 px-4 rounded cursor-not-allowed mt-4" disabled>Apply</button>';
        content += '<p class="text-xs text-gray-500 mt-2">Enable Playground Mode to edit.</p>';
    }
    content += '</form>';

    infoPanelContent.innerHTML = content;

    // Event Listeners for dynamic additions
    document.getElementById('add-capability').addEventListener('click', () => {
        d.capabilities.push({ name: 'new_capability', capacity: 0, util: 0, type: 'ephemeral' });
        update_specs(d);
    });

    document.getElementById('add-action-flow').addEventListener('click', () => {
        if (!d.action_flows) d.action_flows = [];
        d.action_flows.push({ name: 'new_flow', weight: 1, self_initiated: false, actions: [], capabilities_utilization: {} });
        update_specs(d);
    });

    document.querySelectorAll('.add-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const flowIndex = e.target.dataset.flowIndex;
            d.action_flows[flowIndex].actions.push({ target_node: '', edge_id: '', count: 1 });
            update_specs(d);
        });
    });

    document.querySelectorAll('.delete-capability').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = e.target.dataset.index;
            d.capabilities.splice(index, 1);
            update_specs(d);
        });
    });

    document.querySelectorAll('.delete-flow').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const flowIndex = e.target.dataset.flowIndex;
            d.action_flows.splice(flowIndex, 1);
            update_specs(d);
        });
    });

    document.querySelectorAll('.delete-action').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const flowIndex = e.target.dataset.flowIndex;
            const actionIndex = e.target.dataset.actionIndex;
            d.action_flows[flowIndex].actions.splice(actionIndex, 1);
            update_specs(d);
        });
    });

    if (isPlaygroundModeEnabled) {
        document.getElementById('delete-node').addEventListener('click', () => {
            if (confirm(`Are you sure you want to delete the node "${d.name}"?`)) {
                const nodeIndex = window.stack.nodes.findIndex(n => n.name === d.name);
                if (nodeIndex > -1) {
                    window.stack.nodes.splice(nodeIndex, 1);
                    // Also remove any actions targeting this node
                    window.stack.nodes.forEach(n => {
                        if (n.action_flows) {
                            n.action_flows.forEach(f => {
                                f.actions = f.actions.filter(a => a.target_node !== d.name);
                            });
                        }
                    });
                    update_state(window.stack);
                    document.getElementById('info-panel').classList.add('hidden');
                }
            }
        });
    }


    document.getElementById('node-edit-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const originalName = d.name;
        const node = findNode(window.stack.nodes, originalName);

        if (node) {
            node.name = formData.get('name');
            node.count = parseInt(formData.get('count'), 10);

            // Update capabilities
            const newCapabilities = [];
            let capIndex = 0;
            while (formData.has(`cap_name_${capIndex}`)) {
                const capacity = parseFloat(formData.get(`cap_capacity_${capIndex}`));
                const oldCap = node.capabilities[capIndex];
                const util = oldCap ? oldCap.util : 0;
                newCapabilities.push({
                    name: formData.get(`cap_name_${capIndex}`),
                    capacity: capacity,
                    util: util,
                    type: formData.get(`cap_type_${capIndex}`)
                });
                capIndex++;
            }
            node.capabilities = newCapabilities;

            // Update action flows
            node.action_flows = [];
            let flowIndex = 0;
            while (formData.has(`flow_name_${flowIndex}`)) {
                const capabilities_utilization = {};
                node.capabilities.forEach(cap => {
                    const util = parseFloat(formData.get(`cap_util_${flowIndex}_${cap.name}`));
                    if (!isNaN(util)) {
                        capabilities_utilization[cap.name] = util;
                    }
                });

                const flow = {
                    name: formData.get(`flow_name_${flowIndex}`),
                    weight: parseFloat(formData.get(`flow_weight_${flowIndex}`)),
                    self_initiated: formData.has(`flow_self_initiated_${flowIndex}`),
                    actions: [],
                    capabilities_utilization: capabilities_utilization
                };
                let actionIndex = 0;
                while (formData.has(`action_target_${flowIndex}_${actionIndex}`)) {
                    const edgeId = node.action_flows[flowIndex] && node.action_flows[flowIndex].actions[actionIndex] ? node.action_flows[flowIndex].actions[actionIndex].edge_id : '';
                    flow.actions.push({
                        target_node: formData.get(`action_target_${flowIndex}_${actionIndex}`),
                        edge_id: edgeId,
                        count: parseInt(formData.get(`action_count_${flowIndex}_${actionIndex}`), 10)
                    });
                    actionIndex++;
                }
                node.action_flows.push(flow);
                flowIndex++;
            }
            
            // If the name was changed, we need to update any links pointing to this node
            if (originalName !== node.name) {
                window.stack.nodes.forEach(n => {
                    if (n.action_flows) {
                        n.action_flows.forEach(f => {
                            f.actions.forEach(a => {
                                if (a.target_node === originalName) {
                                    a.target_node = node.name;
                                }
                            });
                        });
                    }
                });
            }

            update_state(window.stack);
            infoPanel.classList.add('hidden');
        }
    });

    infoPanel.classList.remove('hidden');
}

document.getElementById('close-info-btn').addEventListener('click', () => {
    document.getElementById('info-panel').classList.add('hidden');
});


// --- ANIMATION LOGIC ---
function animateLinks(allLinks, animationGroup) {
    let animationData = [];
    for (let i = 0; i < animated_balls_count; i++) {
        animationData = animationData.concat(allLinks.map(link => ({ ...link, id: i, offset: (Math.random() - 0.5) * 20 })));
    }

    const circles = animationGroup.selectAll('circle')
        .data(animationData, d => `${d.source.name}-${d.target.name}-${d.id}`);

    // Exit selection: remove old circles
    circles.exit().remove();

    // Enter selection: create new circles
    circles.enter().append('circle')
        .attr('r', 5)
        .attr('fill', 'steelblue')
        .each(function (d) {
            const linkElement = this;
            const path = linkGroup.selectAll('.link')
                .filter(linkData => linkData.source.name === d.source.name && linkData.target.name === d.target.name)
                .node();

            if (!path) return;

            const transitionFunc = () => {
                const duration = 2000 + Math.random() * 1000;
                const delay = Math.random() * 2000;

                d3.select(linkElement)
                    .transition()
                    .delay(delay)
                    .duration(duration)
                    .ease(d3.easeLinear)
                    .attrTween('transform', function () {
                        const length = path.getTotalLength();
                        return function (t) {
                            const point = path.getPointAtLength(t * length);
                            const pointPlus = path.getPointAtLength(t * length + 1);
                            const angle = Math.atan2(pointPlus.y - point.y, pointPlus.x - point.x) + Math.PI / 2;
                            const x = point.x + d.offset * Math.cos(angle);
                            const y = point.y + d.offset * Math.sin(angle);
                            return `translate(${x},${y})`;
                        };
                    })
                    .on('end', transitionFunc);
            };
            transitionFunc();
        });

    // Update selection: update existing circles
    circles.each(function (d) {
        const linkElement = d3.select(this);
        // Here you could update properties of existing circles if needed,
        // for example, if their paths change due to node movement.
        // The existing transition will continue, but for a more robust solution,
        // you might want to interrupt the old transition and start a new one.
    });
}

// Find a node from array of nodes
function findNode(nodes, name) {
    for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].name === name) {
            return nodes[i];
        }
    }
    return null;
}
