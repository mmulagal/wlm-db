import { RouteTags } from '../../utils/consts';
import { DiscoverMsSqlParams, DiscoverMsSqlResponseBody, DiscoverMsSqlQuery } from '../types/discover.types';
import { GenericHeaders } from '../types/generic.types';

const DiscoverMsSqlSchema = {
    Headers: GenericHeaders,
    tags: [RouteTags.DISCOVER],
    params: DiscoverMsSqlParams,
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

// eslint-disable-next-line import/prefer-default-export
export { DiscoverMsSqlSchema };
