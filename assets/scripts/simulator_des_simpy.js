const quant = 500;
let base_time = Date.now()

function log_(...args){
    let c_time = Date.now()
    console.log("time: ",c_time-base_time,...args)
}


async function consume(node, want_time, node_ix, reqid) {
    let node_cpu_cap = node.capabilities.filter(cap => cap.name == "cpu")[0];
    let core_count = node_cpu_cap.capacity
    log_(node.name, node_ix, reqid, "finding core to be free...")
    // log_(node.live_data, node.name, node_ix, core_count)
    while (true) {
        // Find the first core that is free right now
        for (let i = 0; i < core_count; i++) {
            if (!node.live_data[node_ix].core_locks[i]) {

                // log_(node.name, "found free core ", i)
                node.live_data[node_ix].core_locks[i] = true;
                log_(node.name, node_ix, reqid, "found core...")
                // Schedule the task
                const task = new Promise(resolve => setTimeout(resolve, want_time));

                // Chain the completion and release the lock
                node.live_data[node_ix].core_queue[i] = task.then(() => { node.live_data[node_ix].core_locks[i] = false; });

                // Wait for this task to complete
                const randomNum = Math.random();

                await task;
                await new Promise(resolve => setTimeout(resolve, 0));
                return;
            }
        }

        // If no core is free, wait until the soonest one is done
        log_(node.name, reqid, "waiting for core to be free...")
        await Promise.race(node.live_data[node_ix].core_queue);
    }
}

async function compute(node, time, node_ix, reqid) {
    while (time != 0) {
        let want = Math.min(time, quant)
        await consume(node, want, node_ix, reqid)
        time -= want
    }
}


let simulation_started;
let global_time_max = 0;
let tick_time = 1; // 100 ms



function simulate() {
    let stack = window.stack;

    if (simulation_started) {
        return;
    }
    // log_(stack, "simulate already stated");

    simulation_started = setInterval(() => {
        update_nodes();
    }, 1000);


    simulation_started = setTimeout(() => {
        // loop2
        base_time = Date.now()
        window.stack.nodes.forEach(node => {
            check_self_initiated_actions(node)
        });

    }, 1000);
}


function update_nodes() {
    // loop1
    window.stack.nodes.forEach(node => {
        if (!node.live_data) {
            let node_cpu_cap = node.capabilities.filter(cap => cap.name == "cpu")[0];
            node.live_data = Array.from({ length: node.count }, () => ({
                core_queue: Array.from({ length: node_cpu_cap.capacity }, () => Promise.resolve()),
                core_locks: Array.from({ length: node_cpu_cap.capacity }, () => false)
            }));
        }
    })

}



function check_self_initiated_actions(node) {
    for (let node_ix = 0; node_ix < node.count; node_ix++) {
        node.action_flows.forEach(actionF => {

            if (actionF.self_initiated) {
                let reqid = randInt(500000);
                process_node_action(node, actionF.name, node_ix, reqid)
            }
        })
    }
}



async function process_node_action(node, actionF_name, node_ix, reqid) {
    const start = Date.now();
    log_("starting ", node.name, node_ix, reqid)
    let actionF = node.action_flows.find(_actionF => _actionF.name == actionF_name);

    let time_taken = actionF.capabilities_utilization["cpu"];
    
    await compute(node, time_taken, node_ix, reqid)

    for (const action of actionF.actions) {
        let target_node = stack.nodes.find(_node => _node.name == action.target_node);
        target_node_ix = randInt(target_node.count);
        
        await process_node_action(target_node, actionF.name, target_node_ix, reqid);
    }
    const end = Date.now();
    log_("end ", node.name, node_ix, reqid)

    const diffMs = end - start;
    log_("req done latency ", node.name, node_ix, reqid, diffMs)

}

const randInt = n => Math.floor(Math.random() * (n));