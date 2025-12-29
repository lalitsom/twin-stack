// from node.name to node.name map

// function randomNormal(mean, stddev) {
//     let u = 0, v = 0;
//     while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
//     while (v === 0) v = Math.random();
//     let num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
//     num = num * stddev + mean; // Transform to the desired mean and standard deviation
//     if (num < 0) num = 0; // Ensure non-negative
//     return num;
// }


// function get_bfs_level(root) {
//     let queue = [root];
//     let result = [];
//     while (queue.length > 0) {
//         let levelSize = queue.length;
//         let currentLevel = new Set();
//         for (let i = 0; i < levelSize; i++) {
//             let node = queue.shift();
//             currentLevel.add(node)
//             // currentLevel.push(node.name);
//             if (node.children) {
//                 queue.push(...node.children);
//             }
//         }
//         result.push(Array.from(currentLevel));
//     }
//     return result;
// }


// reset all req_to_process to 0, traverse whole tree
// function reset_req_to_process(node) {
//     node.req_to_process = 0;
//     node.total_time = 0;
//     if (node.children) {
//         node.children.forEach(child => {
//             reset_req_to_process(child);
//         });
//     }
// }

// function get_total_time(node) {
//     node.total_time = (node.compute_time || 0) + (node.io_time || 0);
//     if (node.children) {
//         let child_times = []
//         node.children.forEach(child => {
//             child_times.push(get_total_time(child));
//         });
        
//         if ( node.children>1 && node.type === "envoy"){
//             node.total_time += Math.max(...child_times);
//         }
//         else{
//             node.total_time += child_times.reduce((a, b) => a + b, 0);
//         }
        
//     }
//     return node.total_time;
// }

// function calculate_new_state_bfs(new_roots) {
//     if (!Array.isArray(new_roots)) {
//         new_roots = [new_roots];
//     }

//     new_roots.forEach(new_root => {
//         levels = get_bfs_level(new_root);
//         // new_root.count = Math.max(0, Math.floor(randomNormal(new_root.count, 32)));

//         reset_req_to_process(new_root);
//         user = new_root;
//         user.req_to_process = user.count;


//     // calculate request to process per iteration
//     levels.forEach(level => {
//         level.forEach(node => {
//             node.children.forEach(child => {
//                 multiplication_f = (new_root.multiplier[node.name + ":" + child.name] || 1);
//                 child.req_to_process += (node.req_to_process * multiplication_f);
//             });
//         });
//     });


//     // calculate cpu compute time
//     levels.forEach(level => {
//         level.forEach(node => {
//             node.children.forEach(child => {
//                 cpus_avail = Math.min(child.req_to_process, child.count * child.cpu);
//                 child.compute_time = (child.req_to_process * child.latency_preq_pcore) / cpus_avail;
//                 child.io_time = (child.req_to_process * (child.io_preq || 0)) / cpus_avail;
//             });
//         });
//     });
    

//     get_total_time(user)
//     // calculate cpu utilization compute/total + ram util
//     levels.forEach(level => {
//         level.forEach(node => {
//             node.children.forEach(child => {
//                 child.cpu_util = child.compute_time * 100 / user.total_time;
//                 child.ram_util = (child.mem_preq * child.req_to_process * 100) / (child.count * child.ram * 1024 *1024);
//                 child.rps = child.req_to_process * 1000 / user.total_time;
//             });
//         });
//     });


//         new_root.rps = new_root.req_to_process * 1000 / new_root.total_time;
//         new_root.latency = new_root.total_time;
//     });

//     return new_roots;
// }






// let updateInterval;

// function update_state(stack) {
//     console.log("what");
//     window.stack = stack;
//     let data_updated = stack;
//     update(data_updated);

//     if (updateInterval) clearInterval(updateInterval);
//     updateInterval = setInterval(() => {
//         update_state(window.stack);
//     }, 1000);
// }


// function centerAndZoom() {
//     const bounds = nodeGroup.node().getBBox();
//     const parent = nodeGroup.node().parentElement;
//     const fullWidth = parent.clientWidth || parent.parentNode.clientWidth;
//     const fullHeight = parent.clientHeight || parent.parentNode.clientHeight;
//     const width = bounds.width;
//     const height = bounds.height;
//     const midX = bounds.x + width / 2;
//     const midY = bounds.y + height / 2;

//     if (width === 0 || height === 0) return; // nothing to fit

//     const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
//     const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

//     const transform = d3.zoomIdentity
//         .translate(translate[0], translate[1])
//         .scale(scale);

//     svg.transition().duration(750).call(zoom.transform, transform);
// }

// // The initial update will be triggered by user interaction.
// setTimeout(centerAndZoom, 100);
