import { RouteTags } from '../../utils/consts';
import {mssqlparams, DatabasesResponseBody } from '../types/mssql.types'
 

const GetDatabasesSchema = {
    tags: [RouteTags.MSSQL],
    params: mssqlparams,
    description: 'List of Databases',
    response: {
        200: DatabasesResponseBody
    }
};

export {GetDatabasesSchema};