# WLMDB local setup instructions

-   Install a local mysql server,
-   Create database by name wlmdb
-   Create .env file in server/ folder, and configure DATABASE_URL; (https://www.prisma.io/docs/reference/database-reference/connection-urls#env)
-   Whenever there is any change in the schema file, run command `npx prisma migrate dev --name "<appropriate value for the change"  ` this will generate a migration file, commit that migration file as part of the source control.
-   npm install
-   npx prisma migrate deploy
-   npx prisma generate
