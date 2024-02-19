import credentials from './credentials';
import aws from './aws';
import mssql from './mssql';
import resource from './resource';
import config from './config';
import databaseHosts from './databaseHosts';
import chatbot from './chatbot';
import createUserDb from './createUserDb';

const routes = {
    credentials,
    aws,
    mssql,
    resource,
    config,
    databaseHosts,
    chatbot,
    createUserDb
};
export default routes;
