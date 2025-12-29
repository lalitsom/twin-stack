let updateInterval;

function update_state(stack) {
    window.stack = stack;
    let data_updated = stack;
    timestamp = new Date();
    update(data_updated);

    if (updateInterval) clearInterval(updateInterval);
    updateInterval = setInterval(() => {
        update_state(window.stack);
    }, 1000);
    simulate();
}


function centerAndZoom() {
    const bounds = nodeGroup.node().getBBox();
    const parent = nodeGroup.node().parentElement;
    const fullWidth = parent.clientWidth || parent.parentNode.clientWidth;
    const fullHeight = parent.clientHeight || parent.parentNode.clientHeight;
    const width = bounds.width;
    const height = bounds.height;
    const midX = bounds.x + width / 2;
    const midY = bounds.y + height / 2;

    if (width === 0 || height === 0) return; // nothing to fit

    const scale = 0.85 / Math.max(width / fullWidth, height / fullHeight);
    const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

    const transform = d3.zoomIdentity
        .translate(translate[0], translate[1])
        .scale(scale);

    svg.transition().duration(750).call(zoom.transform, transform);
}

// The initial update will be triggered by user interaction.
setTimeout(centerAndZoom, 100);
