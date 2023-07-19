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
export async function getAwsCredentials(accountId: string){
  const data = await getAllAwsCredentials(accountId);
  const modifiedData = data.map(({ credentialsId, extra: { name, arn } }) => ({
    credentialsId,
    name,
    arn
  }));
  return modifiedData
}
