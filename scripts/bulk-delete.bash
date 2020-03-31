#!/bin/bash
echo Enter your JupiterOne accountId
read J1_ACCOUNT_ID

echo Enter your JupiterOne API token
read J1_API_TOKEN

echo Enter the J1QL query to get the list of entities to be deleted. For example: Find aws_instance with _source='system-mapper' 
read J1_QUERY

echo Executing...

j1 \
  -q "$J1_QUERY as e return e._id as entityId" \
  -a $J1_ACCOUNT_ID -k $J1_API_TOKEN \
  --output-file /tmp/j1-temp-entities.json
j1 \
  -o delete --entity --hard-delete \
  -f /tmp/j1-temp-entities.json \
  -a $J1_ACCOUNT_ID -k $J1_API_TOKEN

rm /tmp/j1-temp-entities.json
