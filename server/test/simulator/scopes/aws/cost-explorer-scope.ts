import { CostExplorerClient, GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';

import { mockClient } from 'aws-sdk-client-mock';

const pricingMock = mockClient(CostExplorerClient);

const GetCostAndUsageCommandResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'b944be8a-c023-46cf-a466-8270e5f690b5',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    DimensionValueAttributes: [],
    ResultsByTime: [
        {
            Estimated: false,
            Groups: [],
            TimePeriod: {
                End: '2023-11-01',
                Start: '2023-10-01'
            },
            Total: {
                UnblendedCost: {
                    Amount: '0',
                    Unit: 'USD'
                }
            }
        },
        {
            Estimated: true,
            Groups: [],
            TimePeriod: {
                End: '2023-11-30',
                Start: '2023-11-01'
            },
            Total: {
                UnblendedCost: {
                    Amount: '118.7759587606',
                    Unit: 'USD'
                }
            }
        }
    ]
};

pricingMock.on(GetCostAndUsageCommand).resolves(GetCostAndUsageCommandResponse);

export default GetCostAndUsageCommandResponse;
