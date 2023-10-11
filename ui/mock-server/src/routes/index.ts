import credentials from './credentials';
import aws from './aws';
import mssql from './mssql';
import resource from './resource';
import config from './config';
import databaseHosts from './databaseHosts';

const routes = {
    credentials,
    aws,
    mssql,
    resource,
    config,
    databaseHosts
};
export default routes;
