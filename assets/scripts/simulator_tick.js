let simulation_started;
let global_time_max = 0;
let tick_time = 1; // 100 ms

function simulate() {
    let stack = window.stack;

    if (simulation_started) {
        return;
    }
    console.log(stack, "simulate already stated");

    simulation_started = setInterval(() => {
        update_nodes();
    }, 1000);
}


function update_nodes() {
    // loop1
    window.stack.nodes.forEach(node => {
        if (!node.live_data) {
            
            node.live_data = {
                recieved_req: [],
                sent_req: [],
                received_response: [],
                cpu_ticks : [{ user: 0, idle: 0}],
                time: 0
            }
        }
    })


    // loop2
    window.stack.nodes.forEach(node => {
        console.log(node.name, node.live_data.sent_req, node.live_data.recieved_req, node.live_data.received_response, node.live_data.time)
        process_node(node)
    });

}




function process_node(node) {
    if (node.live_data.time > global_time_max) {
        global_time_max = node.live_data.time;
        console.log("not processing ", node.name);
        return;
    }
    // let cpu_tick = structuredClone(node.live_data.cpu_ticks.at(-1));
    let cpu_tick = {}
    let tick_cpu_spent = 0;

    clear_recieved_responses(node);

    // find all self_initiated ones
    node.action_flows.forEach(actionF => {
        if (actionF.self_initiated) {
            if (node.queue_policy.max_concurrent > node.live_data.sent_req.length) {
                // console.log("self_initiated actionF ", node.name, actionF.name)
                tick_cpu_spent += process_actionF(node, actionF, tick_cpu_spent);
            }
        }
    })

    // console.log("trying actionF ", node.name, node.live_data.recieved_req)
    // all nodes who have some request recieved
    node.live_data.recieved_req.forEach(req => {
        // console.log("recieve ", node.name, req.time, node.live_data.time)
        if (req.time <= node.live_data.time) {
            let actionF = node.action_flows.find(actionF => actionF.name == req.actionF_name);
            if (actionF) {
                // console.log("recieved actionF ", node.name, actionF.name)
                tick_cpu_spent += process_actionF(node, actionF, tick_cpu_spent)
            }
        }
    })

    cpu_tick.user = tick_cpu_spent;
    cpu_tick.idle = tick_cpu_spent ? 0 : tick_time;
    node.live_data.cpu_ticks.push(cpu_tick);


    if (tick_cpu_spent == 0) {
        node.live_data.time += tick_time
    }

    calculate_node_cpu_util(node)
}


function process_actionF(node, actionF, tick_cpu_spent) {
    console.log(node.name, "processing...", actionF.name)

    let cpu_required = actionF.capabilities_utilization["cpu"];

    if (tick_cpu_spent != 0 && (tick_cpu_spent + cpu_required > tick_time)) {
        return 0;
    }

    node.live_data.time += cpu_required;


    // call all dependencies to complete actionF
    actionF.actions.forEach(action => {
        let target_node = stack.nodes.find(_node => _node.name == action.target_node);
        target_node.live_data.recieved_req.push({ node_name: node.name, actionF_name: actionF.name, time: node.live_data.time });
        node.live_data.sent_req.push({ node_name: target_node.name, actionF_name: actionF.name, time: node.live_data.time });
    })

    // no dependencies to complete actionF
    if (actionF.actions.length == 0) {
        node.live_data.received_response.push({ node_name: node.name, actionF_name: actionF.name, time: node.live_data.time });
        clear_recieved_responses(node);
    }
    return cpu_required;

}


function find_node_by_name(node_name) {
    let nodes = window.stack.nodes;
    return nodes[nodes.findIndex(node => node.name == node_name)];
}



function clear_recieved_responses(node) {

    let not_clear_responses = node.live_data.received_response.filter(resp => resp.time > node.live_data.time)

    node.live_data.received_response.forEach((resp) => {
        console.log("clear ", node.name, resp.time, node.live_data.time)
        if (resp.time <= node.live_data.time) {
            const sent_req_index = node.live_data.sent_req.findIndex(req => req.actionF_name == resp.actionF_name); // handle multiple action per actionF later
            if (sent_req_index !== -1) {
                node.live_data.sent_req.splice(sent_req_index, 1);
            }

            const recieved_req_index = node.live_data.recieved_req.findIndex(req => req.actionF_name == resp.actionF_name); // handle multiple action per actionF later
            if (recieved_req_index !== -1) {
                let req_source_name = node.live_data.recieved_req[recieved_req_index].node_name;
                let req_source_node = find_node_by_name(req_source_name);
                req_source_node.live_data.received_response.push({ node_name: node.name, actionF_name: resp.actionF_name, time: node.live_data.time });
                node.live_data.recieved_req.splice(recieved_req_index, 1);
            }
        }
    });

    node.live_data.received_response = not_clear_responses;

}


function calculate_node_cpu_util(node) {
    let node_cpu_cap = node.capabilities.filter(cap => cap.name == "cpu")[0];

    let user = 0;
    let idle = 0;
    node.live_data.cpu_ticks.slice(-12).forEach(tick => {
        user += tick.user;
        idle += tick.idle;
    })
    // console.log("cpu ", node.name, user, idle)

    node_cpu_cap.util = user * 100 / (user + idle)

}