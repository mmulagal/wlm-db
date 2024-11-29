import { mockClient } from 'aws-sdk-client-mock';
import { AutoScalingClient, DescribeAutoScalingInstancesCommand } from '@aws-sdk/client-auto-scaling';

const autoScalingMock = mockClient(AutoScalingClient);
autoScalingMock.on(DescribeAutoScalingInstancesCommand).resolves({
    $metadata: {
        httpStatusCode: 200,
        requestId: '7fac13fb-7089-449d-92c9-837fce9094e2',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    AutoScalingInstances: []
});
