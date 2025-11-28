#!/bin/bash
set -e

echo "Running Terraform setup..."

terraform init
terraform workspace new local 2>/dev/null || terraform workspace select local
terraform apply -auto-approve

echo "Terraform done."
