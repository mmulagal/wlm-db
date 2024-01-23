import { mockClient } from 'aws-sdk-client-mock';
import {
    ResourceGroupsTaggingAPIClient,
    TagResourcesCommand,
    TagResourcesCommandOutput
} from '@aws-sdk/client-resource-groups-tagging-api';

const resourceGroupClientMock = mockClient(ResourceGroupsTaggingAPIClient);

const response: TagResourcesCommandOutput = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'f73d7fe1-a511-4e07-99ab-84f266ee6fec',
        attempts: 1,
        totalRetryDelay: 0
    },
    FailedResourcesMap: {}
};

resourceGroupClientMock.on(TagResourcesCommand).resolves(response);
