#!/bin/bash

(
  cd lambda/payment_initiator
  npm run build
) &

(
  cd lambda/payment_invoke
  npm run build
) &

wait
echo "All builds completed!"
