import { getAllAwsCredentials } from '../../lib/cloud-manager/credentials';
import {CredentialsResponseType } from '../../routes/types/credentials.types'
/**
 * Returns array of aws assume role 
 * credentials added to the account
 */
  async function getAwsCredentials(credentialsType:string): Promise<CredentialsResponseType>{
  const data = await getAllAwsCredentials(credentialsType);
  return data.map(({ credentialsId, extra: { name, arn } }) => ({
    credentialsId,
    name,
    arn,
    providerAccountId: arn.match(/\d+/)?.[0] || '',
  }));
}

export { getAwsCredentials };