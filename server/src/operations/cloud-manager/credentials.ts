import { getAllAwsCredentials } from '../../lib/cloud-manager/credentials';

export async function getAwsCredentials(accountId: string){
  const data = await getAllAwsCredentials(accountId);
  const modifiedData = data.map(({ credentialsId, extra: { name, arn } }) => ({
    credentialsId,
    name,
    arn
  }));
  return modifiedData
}
