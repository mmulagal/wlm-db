import { RouteTags } from '../../utils/consts';
import { DatabaseHostSummaryListResponse } from '../types/database-hosts.types';
import {
    DiscoverMsSqlResponseBody,
    DiscoverMsSqlQuery,
    DiscoverInstanceParams,
    DiscoverCredentialsRequestBody,
    MsSqlInstancesRequestBody
} from '../types/discover.types';
import { GenericHeaders, CredentialsIdParams } from '../types/generic.types';

const DiscoverMsSqlSchema = {
    Headers: GenericHeaders,
    tags: [RouteTags.DISCOVER],
    params: CredentialsIdParams,
    querystring: DiscoverMsSqlQuery,
    summary: 'Discover EC2 instances running on Microsoft Windows platform and hosting Microsoft SQL Server.',
    description: `Discover AWS EC2 instances hosting Microsoft SQL Server.
        EC2 instances meeting the following constraints are
        considered for discovery:
        <ul>
            <li> Instance is in running state.
            <li> Host operatin system is Microsoft Windows.
            <li> Architecture is x86_64.
        </ul>
        <p>If SSM connectivity is available, only those EC2 running
        SQL Server 2016 and above are returned. For EC2s without SSM
        connectivity SQL Server edition constraint is not applicable.`,
    response: {
        200: DiscoverMsSqlResponseBody
    }
};

const DiscoverCredentialsSchema = {
    Headers: GenericHeaders,
    tags: [RouteTags.DISCOVER],
    params: DiscoverInstanceParams,
    body: DiscoverCredentialsRequestBody,
    summary: 'Discover credentials',
    description: 'Store the credentials for a given discovered resource in SSM Parameter Store',
    response: {
        201: {}
    }
};

const MsSqlInstancesSchema = {
    Headers: GenericHeaders,
    tags: [RouteTags.DISCOVER],
    params: CredentialsIdParams,
    body: MsSqlInstancesRequestBody,
    summary: 'Get details of instances with Microsoft Windows platform and hosting Microsoft SQL Server.',
    description: 'Get details of instances with Microsoft Windows platform and hosting Microsoft SQL Server.',
    response: {
        200: DatabaseHostSummaryListResponse
    }
};
export { DiscoverMsSqlSchema, DiscoverCredentialsSchema, MsSqlInstancesSchema };
