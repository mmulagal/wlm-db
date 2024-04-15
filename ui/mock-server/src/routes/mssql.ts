import { BASE_URL, generateResponse } from '../utils/appUtils';

import { CreateMssqlTemplateRes, DeployMssqlTemplate } from '../types/mssqlTypes';
const router = require('express').Router();

//Get Mssql post API mock response
router.post(
    `${BASE_URL}/v1/credentials/:credentialsId/regions/:region/cloudformation/url`,
    async (req: {}, res: CreateMssqlTemplateRes) => {
        const resData = {
            cloudFormationUrl: 'cloud_formation_url',
            warningMessage: 'Required IAM permissions are not available to deploy the cloud formation template'
        };
        generateResponse(res, 200, resData);
    }
);

// To check dialog flow on click of create, uncomment cloudFormationUrl and comment cloudFormationStackId
router.post(
    `${BASE_URL}/v1/credentials/:credentialsId/regions/:region/cloudformation/deploy`,
    async (req: {}, res: DeployMssqlTemplate) => {
        const resData = {
            cloudFormationStackId:
                'arn:aws:cloudformation:ap-southeast-1:464262061435:stack/WLMDB-SQLFCIStack-1694406372501/5bd05510-505b-11ee-82a3-02e1070421d0',
            cloudFormationUrl: 'cloud_formation_url',
            // warningMessage: 'Required IAM permissions are not available to deploy the cloud formation template',
            missingPermissions: {
                implicitlyDenied: [
                    {
                        service: 'ec2',
                        action: 'DisassociateAddress',
                        reason: 'permission statement is missing'
                    },
                    {
                        service: 'ec2',
                        action: 'DisassociateIamInstanceProfile',
                        reason: 'permission statement is missing'
                    },
                    {
                        service: 'ec2',
                        action: 'DisassociateRouteTable',
                        reason: 'permission statement is missing'
                    },
                    {
                        service: 'ec2',
                        action: 'DisassociateSubnetCidrBlock',
                        reason: 'permission statement is missing'
                    },
                    {
                        service: 'ec2',
                        action: 'DisassociateVpcCidrBlock',
                        reason: 'permission statement is missing'
                    },
                    {
                        service: 'ec2messages',
                        action: '*',
                        reason: 'permission blocked due to boundary'
                    },
                    {
                        service: 'kms',
                        action: 'GenerateDataKey',
                        reason: 'permission statement is missing'
                    },
                    {
                        service: 'kms',
                        action: 'Decrypt',
                        reason: 'permission statement is missing'
                    },
                    {
                        service: 'iam',
                        action: 'CreateRole',
                        reason: 'permission statement is missing'
                    },
                    {
                        service: 'iam',
                        action: 'GetRole',
                        reason: 'permission statement is missing'
                    },
                    {
                        service: 'ssm',
                        action: 'DeleteParameters',
                        reason: 'permission statement is missing'
                    }
                ],
                explicitlyDenied: [
                    {
                        service: 'fsx',
                        action: 'TagResource',
                        reason: 'permission is denied in "Effect" or due to other reasons'
                    },
                    {
                        service: 'cloudformation',
                        action: 'CreateStack',
                        reason: 'permission blocked due to boundary'
                    },
                    {
                        service: 'cloudformation',
                        action: 'DescribeStackEvents',
                        reason: 'permission blocked due to boundary'
                    },
                    {
                        service: 'cloudformation',
                        action: 'DescribeStacks',
                        reason: 'permission blocked due to boundary'
                    },
                    {
                        service: 'cloudformation',
                        action: 'ListStacks',
                        reason: 'permission blocked due to boundary'
                    },
                    {
                        service: 'cloudwatch',
                        action: 'GetMetricStatistics',
                        reason: 'permission blocked due to boundary'
                    },
                    {
                        service: 'cloudformation',
                        action: 'ValidateTemplate',
                        reason: 'permission blocked by SCP'
                    },
                    {
                        service: 'cloudformation',
                        action: 'SignalResource',
                        reason: 'permission blocked by SCP'
                    },
                    {
                        service: 'cloudformation',
                        action: 'SignalResource',
                        reason: 'permission blocked by SCP'
                    },
                    {
                        service: 'iam',
                        action: 'PassRole',
                        reason: 'permission blocked by SCP'
                    }
                ]
            }
        };
        generateResponse(res, 200, resData);
    }
);

export default router;
