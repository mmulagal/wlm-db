import credentials from './credentials';
import aws from './aws';
import mssql from './mssql';
import resource from './resource';
import config from './config';
import databaseHosts from './databaseHosts';
import chatbot from './chatbot';
import createUserDb from './createUserDb';
import sandbox from './sandbox';

const routes = {
    credentials,
    aws,
    mssql,
    resource,
    config,
    sandbox,
    databaseHosts,
    chatbot,
    createUserDb
};
export default routes;
