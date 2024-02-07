# WLMDB local setup instructions

-   Install a local mysql server,
-   Create database by name wlmdb
-   Create .env file in server/ folder, and configure DATABASE_URL; (https://www.prisma.io/docs/reference/database-reference/connection-urls#env)
-   Whenever there is any change in the schema file, run command `npx prisma migrate dev --name "<appropriate value for the change"  ` this will generate a migration file, commit that migration file as part of the source control.
-   npm install
-   npx prisma migrate deploy
-   npx prisma generate

# Simulator and Unit test 

-  For simulator and unit test prismock is used to create an inmemory database using the prisma schema that will be only viable till the application is running once its stopped data will be cleared. https://github.com/morintd/prismock 
-  prismock supported an unsupported features are mentioned here https://github.com/morintd/prismock#supported-features

# Spectral for API doc linting
- Simplest way `npm install -g @stoplight/spectral-cli` ; Alternatives (https://meta.stoplight.io/docs/spectral/b8391e051b7d8-installation)
- Run `spectral --version` to confirm installation
- Run `npm install apidoc` to run spectral validation over new set of API changes
- API linting also gets executed as part of the pre-commit hook