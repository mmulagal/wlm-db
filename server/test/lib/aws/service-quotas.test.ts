import { paginatedListServiceQuotas } from '../../../src/lib/aws/service-quotas';
import '../../simulator/scopes/cloud-manager/workload-factory-credentials-scope';
import '../../simulator/scopes/cloud-manager/cloud-manager-tenancy-scope';
import '../../simulator/scopes/cloud-manager/workload-factory-auth-scope';
import { DEFAULT_AWS_REGION, AWSServiceNames } from '../../../src/utils/consts';

import '../../simulator/scopes/aws/service-quota-scope';
import '../../simulator/scopes/opentelemetry-scope';

const CREDENTIALS_ID = '3ad8702a-a2fd-48c2-b150-1ba6ce83aca5';

describe('Cloudformation quota', () => {
    it('Cloudformation quota in valid region', async () => {
        const resp = await paginatedListServiceQuotas(
            CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            AWSServiceNames.CLOUDFORMATION
        );
        expect(resp).toBeDefined();
    });
});
