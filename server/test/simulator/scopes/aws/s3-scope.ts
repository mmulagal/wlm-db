// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import {
    S3Client,
    PutObjectCommand,
    GetBucketLifecycleConfigurationCommand,
    PutBucketLifecycleConfigurationCommand,
    GetObjectCommand
} from '@aws-sdk/client-s3';
import sinon from 'sinon';
import { mockClient } from 'aws-sdk-client-mock';
import { preSignedUrl } from '../../../../src/lib/aws/s3';
import s3GetObjectCommandResponse from '../../responses/aws/s3-get-object-command.json';

const s3Mock = mockClient(S3Client);

s3Mock.on(PutObjectCommand).resolves({});
s3Mock.on(GetBucketLifecycleConfigurationCommand).resolves({});
s3Mock.on(PutBucketLifecycleConfigurationCommand).resolves({});
s3Mock.on(GetObjectCommand).resolves({});
s3Mock.on(GetObjectCommand).resolves(s3GetObjectCommandResponse);

// Mock for getPresignedUrl from s3 sdk is not working as expected, because of that using stub to fake the presigned url
sinon
    .stub(preSignedUrl, 'getPreSignedUrl')
    .callsFake(
        async () =>
            'https://sathish-wlm.s3.ap-southeast-1.amazonaws.com/wlm-master.yaml?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=ASIAWYGBM3V55KVDVT5E%2F20230804%2Fap-southeast-1%2Fs3%2Faws4_request&X-Amz-Date=20230804T064222Z&X-Amz-Expires=3600&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEH8aCXVzLWVhc3QtMSJHMEUCIQDKTkrCudY1wvZe3XP%2BYic8CakEYD89KT%2FuPQLzpeKq5wIgR1QaKgLvDDXQE%2B85WT39y7N2N12Le%2FjkeaLoX1e95j8qmAIIKBAAGgw0NjQyNjIwNjE0MzUiDFDHDmqU4YhaHmOk6ir1AVO8mr%2BTyOVeQXxmTe4WY4BuWNdIC0b4cNqN1PBVx5OLOAw86d0YcL77DWIec%2F6aGGRCCWGu1KXx%2FUxPVfrlSl8zyS8UrDncY9iJYa0n5pbb1KC5k8blEFEHGsF0hBrCPVHaQSymLDh9Vf%2F%2BEhImyiam5txC3tvqwJZJKGX7utDcBib2WA5RcTe%2FYi3WuAlD2GqiizwIm2YweOyxrVkmF0uVnJ6b5L1uKZ%2Bii5xU7NmBk7fJ27gLKJXF%2BBCf4ZgjhgLgwa5Bce8rGF5D%2FFjqe%2BhRrQU2I25df%2BRJI%2F7LHjiW1q%2Bu%2BjNYu2%2ByNcS6ZJS5DiqrhW1SMM67sqYGOp0BD2AFZwmFTJWm0NO8ZjOr0B1EQCChgTOi9TFy4wBV7%2B0cDFpsuMTt%2BrNodXM%2FeWt2uNPhLp6YgalRJ0ndUKUnvEfQrrj2G800SAIPg1vTyMIvVuAZ1bRAqXJCuYx%2FqpawFApF1wd7CCXvjMQcSJg9YBYih7MOnN0daHwkpYbXXdaIhsQCFxU%2FsRCqRbmO6u8YY8rop%2FUhGeYB6JZEfw%3D%3D&X-Amz-Signature=1c0ab92de29c5b0c264639de43eb07675448d3e870617609ae54d71a0df21110&X-Amz-SignedHeaders=host&x-id=GetObject'
    );
