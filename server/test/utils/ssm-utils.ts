const COMMAND_INVOCATION_RESPONSE_TEMPLATE = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-testConnectionCommand',
        attempts: 1,
        totalRetryDelay: 0
    },
    Command: {
        CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-testConnectionCommand',
        DocumentName: 'AWS-RunPowerShellScript',
        ExpiresAfter: '2023-08-28T16:57:41.365Z',
        InstanceIds: ['i-0880a21327284f67c'],
        MaxConcurrency: '50',
        MaxErrors: '0',
        OutputS3Region: 'ap-southeast-1',
        RequestedDateTime: '2023-08-28T14:57:41.365Z'
    }
};

function getSampleCommandResponse(commandName: string) {
    const idInResponse = `a11b873a-3bea-174a-a29e-15532e59a1b4-${commandName}`;
    return {
        $metadata: {
            ...COMMAND_INVOCATION_RESPONSE_TEMPLATE.$metadata,
            requestId: idInResponse
        },
        Command: {
            ...COMMAND_INVOCATION_RESPONSE_TEMPLATE.Command,
            CommandId: idInResponse
        }
    };
}

const COMMAND_RESULT_TEMPLATE = {
    $metadata: {
        httpStatusCode: 200,
        requestId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-testConnectionCommand',
        attempts: 1,
        totalRetryDelay: 0
    },
    CloudWatchOutputConfig: {
        CloudWatchLogGroupName: '',
        CloudWatchOutputEnabled: false
    },
    CommandId: 'a11b873a-3bea-174a-a29e-15532e59a1b4-testConnectionCommand',
    Comment: '',
    DocumentName: 'AWS-RunPowerShellScript',
    DocumentVersion: '$DEFAULT',
    ExecutionElapsedTime: 'PT7.723S',
    ExecutionEndDateTime: '2024-04-26T07:41:01.902Z',
    ExecutionStartDateTime: '2024-04-26T07:40:54.902Z',
    InstanceId: 'i-07862593751ba045b',
    PluginName: 'aws:runPowerShellScript',
    ResponseCode: 0,
    StandardErrorContent: '',
    StandardErrorUrl: '',
    StandardOutputContent: '[{"status": "success", "error": ""}]',
    StandardOutputUrl: '',
    Status: 'Success',
    StatusDetails: 'Success'
};

function getSampleCommandResponseWithOutput(commandName: string, output: string) {
    const idInResponse = `a11b873a-3bea-174a-a29e-15532e59a1b4-${commandName}`;
    return {
        ...COMMAND_RESULT_TEMPLATE,
        StandardOutputContent: output,
        $metadata: {
            ...COMMAND_RESULT_TEMPLATE.$metadata,
            requestId: idInResponse
        }
    };
}

export { getSampleCommandResponse, getSampleCommandResponseWithOutput };
