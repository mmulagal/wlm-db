# WLMDB local setup instructions
- Install a local mysql server, 
- Create database by name wlmdb
- Create .env file in server/ folder, and configure DATABASE_URL;
    Eg: DATABASE_URL="mysql://root:somepassword@host:port/wlmdb"
- npm install
- npx prisma migrate deploy
- npx prisma generate