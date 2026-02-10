#!/bin/bash
set -euxo pipefail

echo "ECS_CLUSTER=${ecs_cluster_name}" >> /etc/ecs/ecs.config
echo "ECS_IMAGE_PULL_BEHAVIOR=always" >> /etc/ecs/ecs.config
