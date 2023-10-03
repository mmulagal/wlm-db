// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    S3Client,
    PutObjectCommand,
    GetBucketLifecycleConfigurationCommand,
    PutBucketLifecycleConfigurationCommand
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';

const s3Mock = mockClient(S3Client);

s3Mock.on(PutObjectCommand).resolves({});
s3Mock.on(GetBucketLifecycleConfigurationCommand).resolves({});
s3Mock.on(PutBucketLifecycleConfigurationCommand).resolves({});
