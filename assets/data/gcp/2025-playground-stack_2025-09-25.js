var stack = {
  "nodes": [
    {
      "name": "user",
      "count": 1,
      "capabilities": [
        {
          "name": "cpu",
          "capacity": 1,
          "util": 0,
          "type": "ephemeral"
        },
        {
          "name": "ram",
          "capacity": 4,
          "util": 0,
          "type": "ephemeral"
        },
        {
          "name": "disk",
          "capacity": 100,
          "util": 0,
          "type": "persistent"
        }
      ],
      "queue_policy": {
        "max_concurrent": 1,
        "queue_limit": 10000
      },
      "metadata": {
        "description": "Simulated user load",
        "type": "users"
      },
      "action_flows": [
        {
          "name": "txn",
          "weight": 1,
          "self_initiated": true,
          "actions": [
            {
              "target_node": "application",
              "edge_id": "user:application",
              "count": 1
            }
          ],
          "capabilities_utilization": {
            "cpu": 0,
            "ram": 50
          }
        }
      ]
    },
    {
      "name": "application",
      "count": 1,
      "capabilities": [
        {
          "name": "cpu",
          "capacity": 1,
          "util": 0,
          "type": "ephemeral"
        },
        {
          "name": "ram",
          "capacity": 4,
          "util": 0,
          "type": "ephemeral"
        },
        {
          "name": "disk",
          "capacity": 100,
          "util": 0,
          "type": "persistent"
        }
      ],
      "queue_policy": {
        "max_concurrent": 1,
        "queue_limit": 10000
      },
      "metadata": {
        "description": "Simulated user load",
        "type": "compute"
      },
      "action_flows": [
        {
          "name": "txn",
          "weight": 1,
          "self_initiated": false,
          "actions": [],
          "capabilities_utilization": {
            "cpu": 1000,
            "ram": 50
          }
        }
      ]
    }
  ],
  "edges": {},
  "stack_name": "2025-playground-stack",
  "metadata": {
    "stats": {},
    "system_snapshot_date": "2025-09-25"
  }
};