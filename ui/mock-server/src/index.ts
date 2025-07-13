import express from 'express';
import registerMiddlewares from './middlewares/register';
import routers from './routes';
import { AddressInfo } from 'net';

const app = express();

registerMiddlewares(app);

app.use('', routers.credentials);
app.use('', routers.aws);
app.use('', routers.mssql);
app.use('', routers.resource);
app.use('', routers.config);
app.use('', routers.sandbox);
app.use('', routers.databaseHosts);
app.use('', routers.chatbot);
app.use('', routers.createUserDb);
app.use('', routers.exploreSavings);
app.use('', routers.inventory);
app.use('', routers.snapcenter);
app.use('', routers.getwell);
app.use('', routers.errorInvestigation);

const server = app.listen(process.env.PORT || 8061, () => {
    const { port } = server.address() as AddressInfo;
    console.log(`👂 Server listening on port ${port}`);
});
