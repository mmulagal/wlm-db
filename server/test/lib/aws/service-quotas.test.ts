import { paginatedListServiceQuotas } from '../../../src/lib/aws/service-quotas';
import { DEFAULT_AWS_REGION, AWSServiceNames } from '../../../src/utils/consts';

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
