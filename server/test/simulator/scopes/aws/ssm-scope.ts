// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { GetCommandInvocationCommand, SendCommandCommand, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import listSendCommandCommandResponse from '../../responses/aws/ssm-sendcommans-response.json';

const ssmMock = mockClient(SSMClient);

const getResponse = {
    $metadata: {
        httpStatusCode: 200,
        requestId: '17601055-7787-4476-8450-2abb4851432a',
        extendedRequestId: undefined,
        cfId: undefined,
        attempts: 1,
        totalRetryDelay: 0
    },
    CloudWatchOutputConfig: { CloudWatchLogGroupName: '', CloudWatchOutputEnabled: false },
    CommandId: 'da23b63e-d6b2-40d2-8d1a-b1f3d7980679',
    Comment: '',
    DocumentName: 'AWS-RunPowerShellScript',
    DocumentVersion: '$DEFAULT',
    ExecutionElapsedTime: 'PT1.528S',
    ExecutionEndDateTime: '2023-08-29T09:54:19.636Z',
    ExecutionStartDateTime: '2023-08-29T09:54:18.636Z',
    InstanceId: 'i-0880a21327284f67c',
    PluginName: 'aws:runPowerShellScript',
    ResponseCode: 0,
    StandardErrorContent: '',
    StandardErrorUrl: '',
    StandardOutputContent:
        '{\r\n' +
        '    "used":  342859776,\r\n' +
        '    "total":  4294557696,\r\n' +
        '    "remaining":  3951697920,\r\n' +
        '    "percentUsed":  7\r\n' +
        '}\r\n',
    StandardOutputUrl: '',
    Status: 'Success',
    StatusDetails: 'Success'
};

ssmMock.on(SendCommandCommand).resolves(listSendCommandCommandResponse);
ssmMock.on(GetCommandInvocationCommand).resolves(getResponse);
