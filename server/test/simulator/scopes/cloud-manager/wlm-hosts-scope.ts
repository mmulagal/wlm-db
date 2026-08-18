import nock from 'nock';
import { WORKLOAD_FACTORY_ENDPOINT } from '../../../../src/utils/consts';
import { buildEc2DatabaseInstancesForRegion, buildEc2StorageGraphDataForRegion } from './wlm-hosts-fixtures';

nock(`${WORKLOAD_FACTORY_ENDPOINT}`, {
    allowUnmocked: process.env.NODE_ENV === 'demo' || process.env.NODE_ENV === 'simulator'
})
    .persist(true)
    .post('/wlm-hosts/graphql')
    .reply((_uri, requestBody) => {
        const { query = '', variables } = requestBody as { query?: string; variables?: { region?: string } };
        const region = variables?.region ?? '';
        const data = query.includes('query Ec2DatabaseInstances')
            ? buildEc2DatabaseInstancesForRegion(region)
            : buildEc2StorageGraphDataForRegion(region);
        return [200, { data }];
    });
