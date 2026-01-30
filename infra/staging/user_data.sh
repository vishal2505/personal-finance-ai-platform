#!/bin/bash
set -euxo pipefail

echo "ECS_CLUSTER=${ecs_cluster_name}" >> /etc/ecs/ecs.config
