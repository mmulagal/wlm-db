// @ts-nocheck
import { DirectoryServiceClient, DescribeDirectoriesCommand } from '@aws-sdk/client-directory-service';
import { mockClient } from 'aws-sdk-client-mock';
import adsResponse from '../../responses/aws/list-ads.json';

const dsMock = mockClient(DirectoryServiceClient);

dsMock.on(DescribeDirectoriesCommand).resolves(adsResponse);
