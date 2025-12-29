let simulation_started;
let global_time_max = 0;
let tick_time = 1; // 100 ms


let global_clock = 0;
let global_queue = [];

// global queue functions

function print_g() {
    console.log("global_queue :", JSON.stringify(global_queue))
}

function push_g(global_queue, obj) {
    global_queue.push(obj)
    console.log("push_g")
    print_g()
}

function sort_g(global_queue) {
    global_queue.sort()
    console.log("sort_g")
    print_g()
}

function shift_g(global_queue) {
    let a = global_queue.shift()
    console.log("shift_g")
    print_g()
    return a
}


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
                pending_reqs: 0,
                cpu_ticks: [{ user: 0, idle: 0 }],
                busy_till: 0,
                cpu_time: [{ clock: 0, time_spent: 0 }]
            }
        }
    })


    // loop2
    window.stack.nodes.forEach(node => {
        check_self_initiated_actions(node)
    });
    window.stack.nodes.forEach(node => {
        process_queue()
    });
    window.stack.nodes.forEach(node => {
        calculate_node_cpu_util(node)
    });

}



function check_self_initiated_actions(node) {
    node.action_flows.forEach(actionF => {
        if (actionF.self_initiated) {
            while ((node.queue_policy.max_concurrent * node.count) > node.live_data.pending_reqs) {
                node.live_data.pending_reqs += 1
                add_in_queue(global_clock, "self", node.name, actionF.name, "req");
            }
        }
    })
}


function add_in_queue(time, src_name, dest_name, actionF_name, action_type) {
    push_g(global_queue, [time, src_name, dest_name, actionF_name, action_type])
}


function process_queue() {
    sort_g(global_queue)
    if (global_queue.length > 0) {
        nearest_event = shift_g(global_queue)
        global_clock = Math.max(nearest_event[0], global_clock)


        process_event(nearest_event)
        while (global_queue.length > 0 && global_queue[0][0] == nearest_event[0]) {
            same_time_event = shift_g(global_queue)
            process_event(same_time_event)
        }

    }
}


function process_event(event) {
    let [time, src_name, dest_name, actionF_name, action_type] = event
    // console.log("process_event: ", time, src_name, dest_name, actionF_name, action_type)

    event_node = stack.nodes.find(_node => _node.name == dest_name);
    actionF = event_node.action_flows.find(_actionF => _actionF.name == actionF_name);

    if (action_type == "resp") {
        event_node.live_data.pending_reqs -= 1
    }
    else {
        let time_taken = actionF.capabilities_utilization["cpu"];
        event_node.live_data.cpu_time.push({ clock: global_clock, time_spent: time_taken })


        // call all dependencies to complete event
        actionF.actions.forEach(action => {
            let target_node = stack.nodes.find(_node => _node.name == action.target_node);
            add_in_queue(global_clock + time_taken, event_node.name, target_node.name, actionF.name, "req")
        })

        // no dependencies to complete event, send back response
        if (actionF.actions.length == 0) {
            add_in_queue(global_clock + time_taken, event_node.name, src_name, actionF.name, "resp")
        }
    }

}


function calculate_node_cpu_util(node) {
    let node_cpu_cap = node.capabilities.filter(cap => cap.name == "cpu")[0];

    let cpu_time = 0
    let metric_chunk = node.live_data.cpu_time.slice(-15)

    let min = metric_chunk.at(0).clock
    let max = metric_chunk.at(metric_chunk.length - 1).clock

    metric_chunk.forEach(record => {
        cpu_time += record.time_spent
    })
    cpu_time -= metric_chunk[metric_chunk.length - 1].time_spent


    console.log(node.name, metric_chunk, min, max, cpu_time)
    total = max - min;
    node_cpu_cap.util = cpu_time * 100 / (total * node_cpu_cap.capacity * node.count)

}