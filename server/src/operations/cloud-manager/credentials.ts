import { getAllAwsCredentials } from '../../lib/cloud-manager/credentials';

/**
 * Takes accountId and returns array of aws assume role 
 * credentials added to the account
 * @param accountId 
 * @returns [{
    credentialsId,
    name,
    arn
  }]
 */
export async function getAwsCredentials(){
  const data = await getAllAwsCredentials();
  const modifiedData = data.map(({ credentialsId, extra: { name, arn } }) => ({
    credentialsId,
    name,
    arn,
    providerAccountId: arn.match(/\d+/)?.[0] || '',
  }));
  return modifiedData
}
