export const workloadPolicies = [
    {
        name: 'well-architected-fsx',
        description:
            'Permissions for FSx operations to support well-architected framework recommendations and optimizations',
        immutable: false,
        isDefault: false,
        permissions: {
            Version: '2012-10-17',
            Statement: [
                {
                    Sid: 'WellArchitecturedFsxGroup',
                    Effect: 'Allow',
                    Action: ['fsx:UpdateFileSystem', 'fsx:UpdateVolume'],
                    Resource: '*'
                }
            ]
        }
    },
    {
        name: 'well-architected-compute-optimizer',
        description:
            'Permissions for AWS Compute Optimizer integration to support well-architected framework cost optimization and performance recommendations',
        immutable: false,
        isDefault: false,
        permissions: {
            Version: '2012-10-17',
            Statement: [
                {
                    Sid: 'WellArchitecturedComputeOptimizerGroup',
                    Effect: 'Allow',
                    Action: [
                        'compute-optimizer:GetEnrollmentStatus',
                        'compute-optimizer:PutRecommendationPreferences',
                        'compute-optimizer:GetEffectiveRecommendationPreferences',
                        'compute-optimizer:GetEC2InstanceRecommendations',
                        'autoscaling:DescribeAutoScalingGroups',
                        'autoscaling:DescribeAutoScalingInstances'
                    ],
                    Resource: '*'
                }
            ]
        }
    },
    {
        name: 'instance-profile',
        description:
            'Instance profile permissions for EC2 instances to access AWS services including CloudWatch, SSM, FSx, and logging capabilities',
        immutable: false,
        isDefault: false,
        permissions: {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: ['cloudwatch:List*', 'cloudwatch:Get*', 'cloudwatch:Describe*', 'cloudwatch:PutMetricData'],
                    Effect: 'Allow',
                    Resource: '*',
                    Sid: 'CloudWatchStatement'
                },
                {
                    Action: [
                        'logs:CreateLogStream',
                        'logs:CreateLogGroup',
                        'logs:GetLogEvents',
                        'logs:GetLogDelivery',
                        'logs:GetLogRecord',
                        'logs:ListLogDeliveries',
                        'logs:DescribeLogGroups',
                        'logs:DescribeLogStreams',
                        'logs:PutLogEvents',
                        'logs:TagResource'
                    ],
                    Effect: 'Allow',
                    Resource: '*',
                    Sid: 'CloudLogStatement'
                },
                {
                    Action: ['sts:GetCallerIdentity'],
                    Effect: 'Allow',
                    Resource: '*',
                    Sid: 'STSStatement'
                },
                {
                    Action: [
                        'ssm:DescribeAssociation',
                        'ssm:GetDeployablePatchSnapshotForInstance',
                        'ssm:GetDocument',
                        'ssm:DescribeDocument',
                        'ssm:GetManifest',
                        'ssm:ListAssociations',
                        'ssm:ListInstanceAssociations',
                        'ssm:GetCommandInvocation',
                        'ec2messages:GetEndpoint',
                        'ec2messages:GetMessages'
                    ],
                    Effect: 'Allow',
                    Resource: '*',
                    Sid: 'SSMListStatement'
                },
                {
                    Action: ['fsx:DescribeFileSystems', 'fsx:DescribeVolumes', 'fsx:DescribeStorageVirtualMachines'],
                    Effect: 'Allow',
                    Resource: '*',
                    Sid: 'FsxStatement'
                },
                {
                    Action: [
                        'ssmmessages:CreateControlChannel',
                        'ssmmessages:CreateDataChannel',
                        'ssmmessages:OpenControlChannel',
                        'ssmmessages:OpenDataChannel',
                        'ssm:PutInventory',
                        'ssm:PutComplianceItems',
                        'ssm:PutConfigurePackageResult',
                        'ssm:UpdateAssociationStatus',
                        'ssm:UpdateInstanceAssociationStatus',
                        'ssm:UpdateInstanceInformation',
                        'ssm:SendCommand'
                    ],
                    Effect: 'Allow',
                    Resource: '*',
                    Sid: 'SSMCreateStatement'
                },
                {
                    Action: ['ssm:GetParameter', 'ssm:GetParameters', 'ssm:PutParameter', 'ssm:GetParametersByPath'],
                    Effect: 'Allow',
                    Resource: 'arn:aws:ssm:*:*:parameter/netapp/wlmdb/*',
                    Sid: 'SSMGetPutParameter'
                }
            ]
        }
    }
];
