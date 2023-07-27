import express from 'express';
import registerMiddlewares from './middlewares/register';
import routers from './routes';
import { AddressInfo } from 'net';

const app = express();

registerMiddlewares(app);

app.use('', routers.credentials);

const server = app.listen(process.env.PORT || 8061, () => {
    const { port } = server.address() as AddressInfo;
    console.log(`👂 Server listening on port ${port}`);
});
