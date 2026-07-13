set -e

# Use the BUILD_CLEAR_FOLDERS ENV variable to determine whether to remove these folders or not
if [[ "${BUILD_CLEAR_FOLDERS:-true}" == "true" ]]; then
    rm -rf build
    rm -rf build-wad
    rm -rf node_modules
fi

source ./set-base-values.sh
export VITE_GIT_REVISION=`git rev-parse --short HEAD`
echo VITE_GIT_REVISION: $VITE_GIT_REVISION
npm install

echo 'building wad bundles'
rm -rf build-wad
npm run build:wad

echo 'processing configs'
node process-wad-configs.js
