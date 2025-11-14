import { faker } from '@faker-js/faker';
import { GetCostAndUsageCommandInput } from '@aws-sdk/client-cost-explorer';
import GetCostAndUsageCommandResponse from '../../simulator/scopes/aws/cost-explorer-scope';
import { getCostAndUsage } from '../../../src/lib/aws/cost-explorer';

describe('Billing Lib', () => {
    const CREDENTIALS_ID = `${faker.string.alpha(20)}`;
    it('Get Cost and Usage', async () => {
        const fsxInput: GetCostAndUsageCommandInput = {
            TimePeriod: {
                Start: '2023-11-01',
                End: '2023-11-30'
            },
            Filter: {
                And: [
                    {
                        Dimensions: {
                            Key: 'SERVICE',
                            Values: ['Amazon FSx']
                        }
                    },
                    {
                        Dimensions: {
                            Key: 'REGION',
                            Values: ['ap-southeast-1']
                        }
                    },
                    {
                        Tags: {
                            Key: 'wlmdb-cost-resource',
                            Values: ['fs-0d5efc3057c4f12cb']
                        }
                    }
                ]
            },
            Granularity: 'MONTHLY',
            Metrics: ['UnblendedCost']
        };

        const resp = await getCostAndUsage(CREDENTIALS_ID, fsxInput, CREDENTIALS_ID);
        expect(resp).toEqual(GetCostAndUsageCommandResponse);
    });
});
