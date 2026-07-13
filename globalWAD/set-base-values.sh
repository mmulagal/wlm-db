set -e
export AWS_DEFAULT_REGION=us-east-1
case "$stage" in
    staging )
        export VITE_WORKLOAD_IFRAME_URL="https://staging-components.console.workloads.netapp.com"
        ;;
    preprod )
        export VITE_WORKLOAD_IFRAME_URL="https://preprod.console.workloads.netapp.com"
        ;;
    prod )
        export VITE_WORKLOAD_IFRAME_URL="https://console.workloads.netapp.com"
        ;;
    *)
        export VITE_WORKLOAD_IFRAME_URL="https://staging-components.console.workloads.netapp.com"
        ;;
esac
