FROM public.ecr.aws/k3z1v4d2/node:20-alpine

WORKDIR /opt/netapp/wlmdb

ADD package.json ./
ADD package-lock.json ./
ADD config/default.json ./config/default.json
ADD config/production.json ./config/production.json
ADD config/log4js.json ./config/log4js.json
ADD dist/src ./

RUN npm ci --omit=dev

# build mode - development or production
ARG ARG_WLMDB_BUILD_MODE

# Team City build number
ARG ARG_WLMDB_BUILD_TC

# GIT short hash
ARG ARG_WLMDB_BUILD_GIT

# persist arguments as environment variables
ENV ENV_WLMDB_BUILD_GIT $ARG_WLMDB_BUILD_GIT
ENV ENV_WLMDB_BUILD_TC $ARG_WLMDB_BUILD_TC
ENV ENV_WLMDB_BUILD_MODE $ARG_WLMDB_BUILD_MODE

CMD ["node", "--loader", "@esbuild-kit/esm-loader", "index.js"]