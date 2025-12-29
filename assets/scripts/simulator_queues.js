let simulation_started;
let global_time = 0;

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

function start_self_initiated_actionF(node, actionF){
     console.log(node.name, "starting self initiating...", actionF.name)

    // increase utilization required to perform this action flow
    node.capabilities.forEach(cap => {
        if (actionF.capabilities_utilization[cap.name]){
            // cap.util += actionF.capabilities_utilization[cap.name];
            // node.capabilities_used.push(actionF.capabilities_utilization[cap.name]);
            let data_point = [actionF.capabilities_utilization[cap.name], global_time, node.live_data.time]
            node.live_data.utilization[cap.name].push(data_point)
        }
    })

    // complete all actions in this action flow
    // actionF.actions.forEach(action => {
    //     let target_node = stack.nodes.find(_node => _node.name == action.target_node);
    //     target_node.live_data.recieved_req.push((node.name, actionF.name))
    // })


}

function process_actionF(node, actionF) {
    console.log(node.name, "processing...", actionF.name)

    // increase utilization required to perform this action flow
    // node.capabilities.forEach(cap => {
    //     if (actionF.capabilities_utilization[cap.name]){
    //         let data_point = (actionF.capabilities_utilization[cap.name], global_time, node.live_data.time)
    //         node.live_data.utilization[cap.name].push(data_point)
    //     }
    // })

    // complete all actions in this action flow
    // actionF.actions.forEach(action => {
    //     let target_node = stack.nodes.find(_node => _node.name == action.target_node);
    //     target_node.live_data.recieved_req.push((node.name, actionF.name))
    // })


    // reduce utilization required to perform this action flow
    // node.capabilities.forEach(cap => {
    //     if (actionF.capabilities_utilization[cap.name]){
    //         cap.util -= actionF.capabilities_utilization[cap.name];
    //     }
    // })


}

function update_nodes() {
    // loop1
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


    // loop2
    window.stack.nodes.forEach(node => {

        // console.log(node.name, node.live_data.recieved_req.length)
        console.log(node.live_data.utilization.cpu)

        // find all self_initiated ones
        node.action_flows.forEach(actionF => {
            if (actionF.self_initiated) {
                start_self_initiated_actionF(node, actionF)
            }
        })

        // all nodes who have some request recieved
        node.live_data.recieved_req.forEach(req => {
            let actionF = node.action_flows.find(actionF => actionF.name === req);
            if (actionF) {
                process_actionF(node,actionF)
                node.live_data.recieved_req.splice(0,1)
            }
        })

    });

}