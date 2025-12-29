let simulation_started;
let global_time = 0;

function simulate() {

    if (simulation_started) {
        return;
    }
    console.log(stack, "simulate already stated");

    simulation_started = setInterval(() => {
        update_nodes();
    }, 1000);
}


function update_nodes() {
    let stack = window.stack;
    let nodes = stack.nodes;



    // i want to traverse in bfs levels for nodes array to update nodes
    let bfs_levels = get_bfs_levels(nodes);
    update_using_bfs(bfs_levels)

}


function process_recieved_actions(node){
    console.log(node.name, node.live_data.recieved_req)
}

function process_self_initiated_actions(node) {

    if (node.queue_policy.max_concurrent <= node.live_data.sent_req.length){
        return;
    }
    node.action_flows.forEach(actionF => {
        if (actionF.self_initiated) {
            actionF.actions.forEach(action => {
                let target_node = stack.nodes.find(_node => _node.name == action.target_node);
                target_node.live_data.recieved_req.push((node.name, actionF.name));
                node.live_data.sent_req.push(target_node.name, actionF.name)
            })
        }
    })



}


function update_using_bfs(bfs_levels) {

    window.stack.nodes.forEach(node => {
        let utilization = {}
        node.capabilities.forEach(cap => {
            utilization[cap.name] = [];
        })

        if (!node.live_data) {
            node.live_data = {
                recieved_req: [],
                sent_req: [],
                processing_req: [],
                time: 0,
                utilization: utilization
            }
        }
    })

    bfs_levels.forEach(level => {
        level.forEach(node => {
            process_self_initiated_actions(node);
            process_recieved_actions(node);
        })
    });
}


function get_bfs_levels(nodes) {
    if (!nodes || nodes.length === 0) {
        return [];
    }

    const nodesMap = new Map(nodes.map(n => [n.name, n]));
    const adj = new Map(nodes.map(n => [n.name, []]));
    const inDegree = new Map(nodes.map(n => [n.name, 0]));

    for (const node of nodes) {
        if (node.action_flows) {
            for (const flow of node.action_flows) {
                if (flow.actions) {
                    for (const action of flow.actions) {
                        if (action.target_node && nodesMap.has(action.target_node)) {
                            adj.get(node.name).push(action.target_node);
                            inDegree.set(action.target_node, inDegree.get(action.target_node) + 1);
                        }
                    }
                }
            }
        }
    }

    const queue = [];
    for (const [name, degree] of inDegree.entries()) {
        if (degree === 0) {
            queue.push(name);
        }
    }

    const levels = [];
    while (queue.length > 0) {
        const levelSize = queue.length;
        const currentLevel = [];
        for (let i = 0; i < levelSize; i++) {
            const nodeName = queue.shift();
            currentLevel.push(nodesMap.get(nodeName));
            const neighbors = adj.get(nodeName);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    inDegree.set(neighbor, inDegree.get(neighbor) - 1);
                    if (inDegree.get(neighbor) === 0) {
                        queue.push(neighbor);
                    }
                }
            }
        }
        levels.push(currentLevel);
    }

    return levels;
}
