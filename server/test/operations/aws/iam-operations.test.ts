import getMissingPermissionsList from '../../../src/operations/aws/iam-operations';
import { DEFAULT_AWS_CREDENTIALS_ID } from '../../utils/consts';
import { AWS_RESOURCES_ACTION_MAP, DEFAULT_AWS_REGION, SNS } from '../../../src/utils/consts';

describe('List permissions required', () => {
    it('list permissions required to deploy the stack - with all resources', async () => {
        const response = await getMissingPermissionsList(
            DEFAULT_AWS_CREDENTIALS_ID,
            DEFAULT_AWS_REGION,
            AWS_RESOURCES_ACTION_MAP
        );
        expect(response).toBeDefined();
    });

    it('list permissions required to deploy the stack - with skipped resources', async () => {
        const { implicitlyDenied } = await getMissingPermissionsList(DEFAULT_AWS_CREDENTIALS_ID, DEFAULT_AWS_REGION, [
            SNS
        ]);
        let isSnsFound = false;
        for (const perm of implicitlyDenied) {
            if (perm.service.includes(SNS)) {
                isSnsFound = true;
                break;
            }
        }

        expect(isSnsFound).toBe(false);
    });
});
