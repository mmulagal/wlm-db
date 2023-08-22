import {
    SSMClient,
    SendCommandCommand,
    GetCommandInvocationCommand,
    InvocationDoesNotExist,
    SendCommandCommandInput,
    GetCommandInvocationCommandInput,
  } from "@aws-sdk/client-ssm";

import { getCredentialDetails } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();
async function getSSMClient(region: string, credentialsId: string) {
    logger.debug('Getting SSM client:', region, credentialsId);

    const {
        credentials: { accessKey: accessKeyId, secretKey: secretAccessKey, sessionId: sessionToken }
    } = await getCredentialDetails(credentialsId);
    const credentials = { accessKeyId, secretAccessKey, sessionToken };

    return new SSMClient({ credentials, region });
}

async function sendSSMCommand (ssmClient: SSMClient, params: SendCommandCommandInput){
    const sendCommand = new SendCommandCommand(params);
    const response = await ssmClient.send(sendCommand);
    const commandId = response.Command?.CommandId;
    return commandId;
}

async function pollCommandStatus(ssmClient:SSMClient, pollParams: GetCommandInvocationCommandInput):Promise<any>  {
        try {
            const response = await ssmClient.send(
              new GetCommandInvocationCommand(pollParams)
            );
            const status = response.Status;
      
            if (status === "InProgress" || status === "Pending") {
                await new Promise(resolve => setTimeout(resolve, 100)); 
                return pollCommandStatus(ssmClient, pollParams)
            } else {
                return response;
            }
          } catch (error) {
            if (error instanceof InvocationDoesNotExist) {
              logger.info("Command invocation does not exist yet, waiting...");
              await new Promise(resolve => setTimeout(resolve, 100)); 
              return pollCommandStatus(ssmClient, pollParams)
            } else {
              logger.error("Error fetching command status:", error);
            }
          }
    }
   
async function executeSsmDocument(credentialsId:string, region:string, params: SendCommandCommandInput){
    const ssmClient = await getSSMClient(region, credentialsId);
    const commandId = await sendSSMCommand(ssmClient,params);
    const instanceIds = params?.InstanceIds ?? [];
    const pollParams = {
        CommandId:commandId,
        InstanceId: instanceIds[0]
    }
    const response = await pollCommandStatus(ssmClient, pollParams);
   
    return response;
}
export {executeSsmDocument};