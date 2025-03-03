// workaroud for the sdk type issue.. remove this @ts-nocheck once the sdk mock works fine
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
import { SESClient } from '@aws-sdk/client-ses';
import { mockClient } from 'aws-sdk-client-mock';
import { SendRawEmailCommand } from '@aws-sdk/client-ses';

const sesMock = mockClient(SESClient);

sesMock.on(SendRawEmailCommand).resolves({});
