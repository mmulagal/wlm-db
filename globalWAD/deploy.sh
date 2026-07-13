set -e
source ./set-base-values.sh

echo "distribution-id $DISTRIBUTION_ID"
echo "using $1-workloads-components bucket"

echo 'uploading wad config'
aws s3 cp build-wad/wad-config.json s3://$bucket/wlmdb/wad-config.json --content-type "application/json" --cache-control='public,max-age=300,stale-while-revalidate=60'

echo 'uploading wad tables bundle'
aws s3 cp build-wad/wad-db-tables.bundle.js s3://$bucket/wlmdb/wad-db-tables.bundle.js --cache-control='public,max-age=300,stale-while-revalidate=60'

echo 'uploading wad modals bundle'
aws s3 cp build-wad/wad-db-modals.bundle.js s3://$bucket/wlmdb/wad-db-modals.bundle.js --cache-control='public,max-age=300,stale-while-revalidate=60'

if [ -n "$DISTRIBUTION_ID" ]; then
    aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths \/\*
fi
