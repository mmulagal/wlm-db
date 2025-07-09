import credentials from './credentials';
import aws from './aws';
import mssql from './mssql';
import resource from './resource';
import config from './config';
import databaseHosts from './databaseHosts';
import chatbot from './chatbot';
import createUserDb from './createUserDb';
import sandbox from './sandbox';
import exploreSavings from './exploreSavings';
import inventory from './inventory';
import getwell from './getwell';
import errorInvestigation from './errorInvestigation';
import snapcenter from './snapcenter';

const routes = {
    credentials,
    aws,
    mssql,
    resource,
    config,
    sandbox,
    databaseHosts,
    chatbot,
    createUserDb,
    exploreSavings,
    inventory,
    getwell,
    errorInvestigation,
    snapcenter
};
export default routes;
