import { isEmpty, uniqBy } from 'lodash-es';
import { getAdsList } from '../../operations/aws/directory-service-operations';
import { getAmiList, getInstanceTypes, getKeyPairsList, getVpcsList } from '../../operations/aws/ec2-operations';
import { getFSxOntapRegionsList } from '../../operations/aws/ssm-operations';
import getLogger from '../../utils/logger';
import {
    AZ_1,
    AZ_2,
    VPC_CIDR,
    VPC_ID,
    DOMAIN_DNS,
    AD_SCENARIO_TYPE,
    DNS_IP,
    AWS_MANAGED_AD,
    USER_MANAGED_AD,
    SINGLE_AZ,
    MULTI_AZ,
    NEW,
    EXISTING,
    KEY_LABEL_MAP,
    PRIVATE_SUBNET_1,
    PRIVATE_SUBNET_2,
    ROUTE_TABLE_1,
    ROUTE_TABLE_2,
    STANDALONE,
    FCI
} from './consts';
import { getCredentials } from '../../operations/cloud-manager/credentials-operations';
import { getFSxFileSystemsList } from '../../operations/aws/fsx-operations';

const logger = getLogger();

async function validateCredentials(credentialsId: string, key: string) {
    logger.debug('Validate Credentials', { credentialsId });
    const credentials = (await getCredentials('aws_assume_role')) || [];

    if (isEmpty(credentials)) {
        return {
            key,
            status: 'error',
            message: 'No credentials found, please add and try again',
            allowedValues: []
        };
    }

    if (!credentialsId) {
        return {
            key,
            status: 'error',
            message:
                'I would need the credentialsId information to proceed further, please select a credentialsId of your choice',
            allowedValues: credentials.map(credential => ({
                label: credential.name,
                value: credential.credentialsId
            }))
        };
    }

    const credentialsMatched = credentials?.find(reg => reg.credentialsId === credentialsId);
    if (!credentialsMatched) {
        return {
            key,
            status: 'error',
            message:
                'The credential that you provided is not valid. Please select a set of credentials from the list below.',
            allowedValues: credentials.map(cred => ({ label: cred.name, value: cred.credentialsId }))
        };
    }

    return {
        value: credentialsMatched.credentialsId
    };
}

async function validateRegion(credentialsId: string, value: string, key: string) {
    logger.debug('Validate Region', { credentialsId, value });
    const { regions } = (await getFSxOntapRegionsList(credentialsId)) || [];

    if (isEmpty(regions)) {
        return {
            key,
            status: 'error',
            message: 'No regions found, please try again',
            allowedValues: []
        };
    }

    if (!value) {
        return {
            key,
            status: 'error',
            message: 'Select an AWS region for the database.',
            allowedValues: regions.map(reg => ({ label: reg.regionName, value: reg.regionCode }))
        };
    }

    const regionsMatched = regions?.filter(
        reg => reg.regionName?.toLowerCase()?.includes(value?.toLowerCase()) || reg.regionCode === value
    );
    // // console.log(regionsMatched);
    if (regionsMatched.length !== 1) {
        return {
            key,
            status: 'error',
            message: `${
                regionsMatched.length > 1
                    ? 'I found multiple regions that match what you provided.'
                    : 'The region that you provided is not valid.'
            } Please try again.`,
            allowedValues: regionsMatched.length
                ? regionsMatched.map(reg => ({ label: reg.regionName, value: reg.regionCode }))
                : regions.map(reg => ({ label: reg.regionName, value: reg.regionCode }))
        };
    }

    return {
        value: regionsMatched[0]?.regionCode
    };
}

async function validateVpcId(
    credentialsId: string,
    region: string,
    vpcId: string,
    az1: string,
    az2: string,
    subnet1: string,
    subnet2: string,
    key: string
) {
    logger.debug('Validate VpcConfig', { credentialsId, region, vpcId, az1, az2, key });

    const { vpcs } = await getVpcsList(credentialsId, region, 'subnet');

    if (isEmpty(vpcs)) {
        return {
            key,
            status: 'error',
            message: 'No vpcs found, please try again',
            allowedValues: []
        };
    }

    if (!vpcId) {
        return {
            key,
            status: 'error',
            message: key === VPC_ID ? 'Select a VPC for the database.' : 'Select a VPC CIDR for the database.',
            allowedValues: vpcs.map(vpc => ({ label: vpc.name || vpc.id, value: vpc.id }))
        };
    }

    const isValidVpc = vpcs?.find(vpc => vpc.id === vpcId);
    if (!isValidVpc) {
        return {
            key,
            status: 'error',
            message: 'The VPC that you provided is not correct. Please choose a different VPC.',
            allowedValues: vpcs.map(vpc => ({ label: vpc.name || vpc.id, value: vpc.id }))
        };
    }

    const azs = uniqBy(
        isValidVpc.subnets?.map(({ availabilityZone }) => ({ label: availabilityZone, value: availabilityZone })),
        'value'
    );

    switch (key) {
        case VPC_ID:
            return { value: isValidVpc.id || null };
        case VPC_CIDR:
            return {
                value: isValidVpc.cidrBlock?.[0].CidrBlock || null
            };
        case AZ_1: {
            if (!az1) {
                return {
                    key,
                    status: 'error',
                    message: 'Select an Availability Zone for the primary SQL node.',
                    allowedValues: azs
                };
            }
            const subnets = vpcs?.map(vpc => vpc?.subnets);
            const isValidAZ = subnets?.flat().find(subnet => subnet?.availabilityZone === az1);
            logger.debug('isValidAZ', isValidAZ);
            if (!isValidAZ) {
                return {
                    key,
                    status: 'error',
                    message:
                        'The availability zone that you provided is not correct. Please choose a different availability zone.',
                    allowedValues: azs
                };
            }
            return {
                value: az1
            };
        }
        case AZ_2: {
            if (!az2) {
                return {
                    key,
                    status: 'error',
                    message: 'Select an Availability Zone for the secondary SQL node.',
                    allowedValues: azs
                };
            }

            const azs2 = azs.filter(az => az.value !== az2);

            if (isEmpty(azs2)) {
                return {
                    key,
                    status: 'error',
                    message:
                        'This VPC contains only one subnet, please select a different VPC to support FCI deployment',
                    allowedValues: []
                };
            }

            if (az1 === az2) {
                return {
                    key,
                    status: 'error',
                    message: 'Please select a different availability zone for the secondary sql node',
                    allowedValues: azs2
                };
            }
            const subnets = vpcs?.map(vpc => vpc?.subnets);
            const isValidAZ = subnets?.flat().find(subnet => subnet?.availabilityZone === az2);
            logger.debug('isValidAZ', isValidAZ);
            if (!isValidAZ) {
                return {
                    key,
                    status: 'error',
                    message:
                        'The availability zone that you provided is not valid. Please choose a valid availability zone.',
                    allowedValues: azs
                };
            }

            return {
                value: az2
            };
        }
        case PRIVATE_SUBNET_1:
        case PRIVATE_SUBNET_2: {
            if ((key === PRIVATE_SUBNET_1 && !subnet1) || (key === PRIVATE_SUBNET_2 && !subnet2)) {
                return {
                    key,
                    status: 'error',
                    message: 'Select the subnet id',
                    allowedValues: uniqBy(
                        isValidVpc.subnets
                            ?.filter(({ availabilityZone }) =>
                                key === PRIVATE_SUBNET_1 ? availabilityZone === az1 : availabilityZone === az2
                            )
                            ?.map(({ id, name }) => ({
                                label: name,
                                value: id
                            })),
                        'value'
                    )
                };
            }

            const isValidSubnet = isValidVpc.subnets
                ?.filter(({ availabilityZone }) =>
                    key === PRIVATE_SUBNET_1 ? availabilityZone === az1 : availabilityZone === az2
                )
                ?.find(({ id }) => (key === PRIVATE_SUBNET_1 ? id === subnet1 : id === subnet2));

            if (!isValidSubnet) {
                return {
                    key,
                    status: 'error',
                    message: 'The subnet that you provided is not valid, Please choose a valid subnet.',
                    allowedValues: uniqBy(
                        isValidVpc.subnets
                            ?.filter(({ availabilityZone }) =>
                                key === PRIVATE_SUBNET_1 ? availabilityZone === az1 : availabilityZone === az2
                            )
                            ?.map(({ id, name }) => ({
                                label: name,
                                value: id
                            })),
                        'value'
                    )
                };
            }

            return {
                value: key === PRIVATE_SUBNET_1 ? subnet1 : subnet2
            };
        }
        case ROUTE_TABLE_1:
        case ROUTE_TABLE_2: {
            return {
                value: isValidVpc.subnets?.find(({ id }) => (key === ROUTE_TABLE_1 ? id === subnet1 : id === subnet2))
                    ?.routeTableId
            };
        }
        default:
            return {};
    }
}

async function validateKeyName(credentialsId: string, region: string, keyName: string, key: string) {
    logger.debug('Validate Key Name', { credentialsId, region, keyName });
    const { keyPairs: keys } = await getKeyPairsList(credentialsId, region);

    if (!keyName) {
        return {
            key,
            status: 'error',
            message: 'Select a key pair so that you can securely connect to your EC2 instance.',
            allowedValues: keys.map(({ name }) => ({ label: name, value: name }))
        };
    }

    const isValidKey = keys?.find(({ name, id }) => name === keyName || id === keyName);

    if (!isValidKey) {
        return {
            key,
            status: 'error',
            message: 'The key pair that you provided is not valid. Please select a valid key pair.',
            allowedValues: keys.map(({ name }) => ({ label: name, value: name }))
        };
    }
    return {
        value: isValidKey.name || null
    };
}

async function validateImageId(credentialsId: string, region: string, imageId: string, key: string) {
    logger.debug('Validate Image Id', { credentialsId, region, imageId });
    const { amis } = await getAmiList(credentialsId, region, 'Windows', 'SQL');
    if (!imageId) {
        return {
            key,
            status: 'error',
            message: 'Select an AWS AMI for the database.',
            allowedValues: amis.map(({ name, imageId: amiId, description }) => ({
                label: name,
                value: amiId,
                metadata: {
                    description
                }
            }))
        };
    }

    const isValidAmi = amis?.find(ami => ami.imageId === imageId);
    if (!isValidAmi) {
        return {
            key,
            status: 'error',
            message: 'The image id that you provided is not correct. Please select a valid image id.',
            allowedValues: amis.map(({ name, imageId: amiId, description }) => ({
                label: name,
                value: amiId,
                metadata: {
                    description
                }
            }))
        };
    }
    return {
        value: isValidAmi.imageId || null
    };
}

async function validateAdScenarioType(type: string, key: string) {
    if (type === 'AWS_MANAGED_AD' || type === 'USER_MANAGED_AD') {
        return {
            value: type
        };
    }

    return {
        key,
        status: 'error',
        message:
            'The active directory type that you provided is not correct. Please provide a valid active directory type',
        allowedValues: [
            { label: 'AWS_MANAGED_AD', value: 'AWS_MANAGED_AD' },
            { label: 'USER_MANAGED_AD', value: 'USER_MANAGED_AD' }
        ]
    };
}

async function validateInstanceType(credentialsId: string, region: string, workloadInstanceType: string, key: string) {
    logger.debug('Validate Instance Type', { credentialsId, region, workloadInstanceType });
    const { instanceTypes } = await getInstanceTypes(credentialsId, region);
    if (!workloadInstanceType) {
        return {
            key,
            status: 'error',
            message: 'Select an EC2 instance type.',
            allowedValues: instanceTypes.map(({ instanceType }) => ({
                label: instanceType,
                value: instanceType
            }))
        };
    }

    const isValidType = instanceTypes?.find(({ instanceType }) => instanceType === workloadInstanceType);
    if (!isValidType) {
        return {
            key,
            status: 'error',
            message: 'The instance type that you provided is not correct. Please select a valid EC2 instance type.',
            allowedValues: instanceTypes.map(({ instanceType }) => ({
                label: instanceType,
                value: instanceType
            }))
        };
    }
    return {
        value: isValidType.instanceType || null
    };
}

async function validateFsx(credentialsId: string, region: string, vpcId: string, fsxId: string, key: string) {
    logger.info('Validate FSX', credentialsId, region, fsxId);
    const { filesystems } = await getFSxFileSystemsList(credentialsId, region, vpcId);
    if (!fsxId) {
        return {
            key,
            status: 'error',
            message: 'Select a FSxN name.',
            allowedValues: filesystems.map(({ name, fileSystemId }) => ({
                label: `${name ? `${name} | ` : ''}${fileSystemId}`,
                value: fileSystemId
            }))
        };
    }
    const isValidFsx = filesystems?.find(filesystem => filesystem?.fileSystemId === fsxId);
    if (!isValidFsx) {
        return {
            key,
            status: 'error',
            message: 'The fsx information that you provided is not correct. Please provide a valid fsx information.',
            allowedValues: filesystems?.map(({ name, fileSystemId }) => ({
                label: name,
                value: fileSystemId
            }))
        };
    }

    return {
        value: isValidFsx?.fileSystemId || null
    };
}
async function validateCloudWatch(key: string, enableCloudWatch?: boolean) {
    logger.info(' Validate Cloud Watch', { enableCloudWatch, key });
    if (typeof enableCloudWatch !== 'boolean') {
        return {
            key,
            status: 'error',
            message: 'Do you want to enable CloudWatch monitoring',
            allowedValues: [
                { label: 'Yes', value: true },
                { label: 'No', value: false }
            ]
        };
    }
    return {
        value: enableCloudWatch
    };
}

async function validateDomain(
    credentialsId: string,
    region: string,
    domainDnsname: string,
    dnsIp: string,
    key: string
) {
    logger.debug('Validate Domain DNS', { credentialsId, region, domainDnsname, key });
    const { directories } = await getAdsList(credentialsId, region);
    if (!domainDnsname) {
        return {
            key,
            status: 'error',
            message: 'Select the domain DNS name.',
            allowCreate: true,
            allowedValues: uniqBy(
                directories.map(({ domainName }) => ({
                    label: domainName,
                    value: domainName
                })),
                'value'
            )
        };
    }
    const errorResponse = { status: 'error', message: 'Enter the value of domain ip address', type: 'text' };
    const isAWSManagedDomain = directories?.find(({ domainName }) => domainName === domainDnsname);
    switch (key) {
        case DOMAIN_DNS:
            return { value: domainDnsname };
        case AD_SCENARIO_TYPE:
            return { value: isAWSManagedDomain ? AWS_MANAGED_AD : USER_MANAGED_AD };
        case DNS_IP:
            return isAWSManagedDomain
                ? { value: isAWSManagedDomain?.dnsIpAddress?.join(',') }
                : dnsIp
                ? { value: dnsIp }
                : { key, ...errorResponse };
        default:
            return {};
    }
}

function validateText(text: string, key: string) {
    if (!text) {
        return {
            key,
            status: 'error',
            message: `Enter a value for ${KEY_LABEL_MAP[key as keyof typeof KEY_LABEL_MAP]}`,
            type: key.toLowerCase().includes('password') ? 'password' : 'text'
        };
    }
    return { value: text };
}

function validateDbSize(size: number, key: string) {
    logger.debug('Validate DB Size', { size });
    if (!size || typeof size !== 'number' || (size < 120 && size >= 133120)) {
        return {
            key,
            status: 'error',
            message: 'Enter a value for data drive size(GiB) between 120 to 133120',
            type: 'number'
        };
    }

    return {
        value: size
    };
}

function validateThroughPut(iops: number, key: string) {
    logger.debug('Validate ThroughPut', { iops });
    const ThroughPut = [];
    for (let i = 0; i <= 5; i++) {
        ThroughPut.push({ label: `${128 * 2 ** i} Mbps`, value: 128 * 2 ** i });
    }
    if (!iops) {
        return {
            key,
            status: 'error',
            message: 'Select a throughput capacity.',
            allowedValues: ThroughPut
        };
    }

    const isValid = ThroughPut.find(({ value }) => value === iops);
    if (!isValid) {
        return {
            key,
            status: 'error',
            message:
                'The throughput capacity value that you provided is not correct. Please provide a valid throughput capacity.',
            allowedValues: ThroughPut
        };
    }
    return { value: isValid.value || null };
}

async function validateSecurityGroup(
    credentialsId: string,
    region: string,
    vpcId: string,
    securityGroup: string,
    key: string
) {
    logger.debug('Validate Security Group', { credentialsId, region, securityGroup });
    const { vpcs } = await getVpcsList(credentialsId, region, 'securityGroup');

    const vpc = vpcs.find(({ id }) => id === vpcId);
    const secGrp = vpc?.securityGroups || [];

    if (!securityGroup) {
        return {
            key,
            status: 'error',
            message: 'Select an AWS security group.',
            allowedValues: secGrp.map(({ id, securityGroupName }) => ({
                label: securityGroupName,
                value: id
            }))
        };
    }

    const isValid = secGrp?.find(({ id }) => securityGroup === id);
    if (!isValid) {
        return {
            key,
            status: 'error',
            message: 'The security group that you provided is not correct. Please provide a valid security group.',
            allowedValues: secGrp.map(({ id, securityGroupName }) => ({
                label: securityGroupName,
                value: id
            }))
        };
    }
    return {
        value: isValid.id || null
    };
}

async function validateSqlDeploymentType(deploymentType: string, key: string) {
    logger.debug('Validate sql deployment mode', { deploymentType });
    if (![SINGLE_AZ, MULTI_AZ].includes(deploymentType)) {
        return {
            key,
            status: 'error',
            message: 'Select database deployment model.',
            allowedValues: [
                { label: 'Single Instance', value: STANDALONE },
                { label: 'Failover Cluster Instance (FCI)', value: FCI }
            ]
        };
    }
    return { value: deploymentType };
}

function checkFsxType(type: string, key: string) {
    if (type?.toUpperCase() !== NEW && type?.toUpperCase() !== EXISTING) {
        return {
            key,
            status: 'error',
            message: 'Select a FSx type.',
            allowedValues: [
                { label: 'New', value: NEW },
                { label: 'Existing', value: EXISTING }
            ]
        };
    }
    return {
        value: type.toUpperCase()
    };
}

export {
    validateRegion,
    validateVpcId,
    validateKeyName,
    validateImageId,
    validateInstanceType,
    validateDomain,
    validateText,
    validateDbSize,
    validateThroughPut,
    validateSecurityGroup,
    validateSqlDeploymentType,
    validateCredentials,
    validateAdScenarioType,
    checkFsxType,
    validateFsx,
    validateCloudWatch
};
