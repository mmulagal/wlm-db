# WLMDB local setup instructions

-   Install a local mysql server,
-   Create database by name wlmdb
-   Create .env file in server/ folder, and configure DATABASE_URL; (https://www.prisma.io/docs/reference/database-reference/connection-urls#env)
-   npm install
-   npx prisma migrate deploy
-   npx prisma generate
