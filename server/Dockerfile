FROM node:alpine3.18

RUN apk update && apk upgrade --no-cache libcrypto3 libssl3
RUN mkdir -p /log
# Create a new user "netappuser" with UID 1000 and group name "netappgroup"
RUN addgroup -S netappgroup && adduser -S -G netappgroup -u 1001 netappuser

WORKDIR /opt/netapp/wlmdb

# Change ownership of the working directory to the new user
RUN chown -R netappuser:netappgroup /opt/netapp/wlmdb
RUN chmod 777 /log
RUN chown -R netappuser:netappgroup /log

# Switch to the new user
USER netappuser

COPY package.json ./
COPY package-lock.json ./
COPY config/default.json ./config/default.json
COPY config/production.json ./config/production.json
COPY config/log4js.json ./config/log4js.json
COPY resources/mssql/templates/wlm-master.yaml ./resources/mssql/templates/wlm-master.yaml
COPY resources/mssql/templates/vpc-ad-validation.yaml ./resources/mssql/templates/vpc-ad-validation.yaml
COPY resources/mssql/templates/sql-windows-fci-config_nosignal.yaml ./resources/mssql/templates/sql-windows-fci-config_nosignal.yaml
COPY resources/mssql/templates/standalone-deployment.yaml ./resources/mssql/templates/standalone-deployment.yaml
COPY dist/src ./

COPY src/lib/chatbot/schemas/* ./lib/chatbot/schemas

COPY prisma ./prisma/

COPY patches ./patches/

RUN npm ci --omit=dev

# prisma generate command after every change to Prisma schema to update the generated Prisma Client code.
RUN npx prisma generate

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

CMD ["node", "--loader", "./utils/loader.js", "index.js"]