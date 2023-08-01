// @ts-nocheck
import { ServiceQuotasClient, ListServiceQuotasCommand } from '@aws-sdk/client-service-quotas';
import { mockClient } from 'aws-sdk-client-mock';
import regionQuotas from '../../responses/aws/service-quotas.json';

const quotaMock = mockClient(ServiceQuotasClient);

quotaMock.on(ListServiceQuotasCommand).resolves(regionQuotas);
