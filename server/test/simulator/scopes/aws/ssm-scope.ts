// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

import { SendCommandCommand, SSMClient } from '@aws-sdk/client-ssm';
import { mockClient } from 'aws-sdk-client-mock';
import listSendCommandCommandResponse from '../../responses/aws/ssm-sendcommans-response.json';

const ssmMock = mockClient(SSMClient);

ssmMock.on(SendCommandCommand).resolves(listSendCommandCommandResponse);
