// import { faker } from '@faker-js/faker';
// import {
//     calculatePrice
// } from '../../../src/operations/aws/pricing-operations';
import '../../simulator/scopes/cloud-manager/cloud-manager-credentials-scope';
import '../../simulator/scopes/aws/ec2-scope';
import '../../simulator/scopes/opentelemetry-scope';
import { DEFAULT_AWS_CREDENTIALS_TYPE } from '../../utils/consts';
import calculatePrice from '../../../src/operations/aws/pricing-operations';


describe('Pricing Operations', () => {
    it('list of EC2 AMIs', async () => {
        const credentialsType = DEFAULT_AWS_CREDENTIALS_TYPE;
        // const compute = 
        const resp = await calculatePrice(credentialsType,'','','');
        expect(resp).toBeDefined();
    });

});
