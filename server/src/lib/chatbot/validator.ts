import { uniqBy } from 'lodash-es';
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
    MULTI_AZ
} from './consts';
import { getCredentials } from '../../operations/cloud-manager/credentials-operations';
// import { getFSxFileSystemsList } from '../../operations/aws/fsx-operations';

const logger = getLogger();

async function validateCredentials(credentialsId: string, key: string) {
    logger.debug('Validate Credentials', { credentialsId });
    const credentials = (await getCredentials('aws_assume_role')) || [];

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
                'The credentials that you have mentioned seems to be incorrect, please select one from the list below',
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

    if (!value) {
        return {
            key,
            status: 'error',
            message: 'I would need the region information to proceed further, please select a region of your choice',
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
                    ? 'Mulitple regions matching for you input, '
                    : 'The region that you have mentioned seems to be incorrect, '
            }please select an appropriate region`,
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
    key: string
) {
    logger.debug('Validate VpcConfig', { credentialsId, region, vpcId, az1, az2, key });

    const { vpcs } = await getVpcsList(credentialsId, region, 'subnet');

    if (!vpcId) {
        return {
            key,
            status: 'error',
            message:
                key === VPC_ID
                    ? 'Please choose a VPC where you want db instances to be present'
                    : 'Please provide the VPC CIDR',
            allowedValues: vpcs.map(vpc => ({ label: vpc.name || vpc.id, value: vpc.id }))
        };
    }

    const isValidVpc = vpcs?.find(vpc => vpc.id === vpcId);
    if (!isValidVpc) {
        return {
            key,
            status: 'error',
            message: 'The VPC that you provided seems to be incorrect, please choose an appropriate one',
            allowedValues: vpcs.map(vpc => ({ label: vpc.name || vpc.id, value: vpc.id }))
        };
    }

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
                    message: 'Please select an availability zone for the primary sql node',
                    allowedValues: uniqBy(
                        isValidVpc.subnets?.map(({ availabilityZone }) => ({
                            label: availabilityZone,
                            value: availabilityZone
                        })),
                        'value'
                    )
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
                        'The availability zone that you provided seems to be incorrect, please choose an appropriate one',
                    allowedValues: uniqBy(
                        isValidVpc.subnets?.map(({ availabilityZone }) => ({
                            label: availabilityZone,
                            value: availabilityZone
                        })),
                        'value'
                    )
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
                    message: 'Please select an availability zone for the secondary sql node',
                    allowedValues: uniqBy(
                        isValidVpc.subnets?.map(({ availabilityZone }) => ({
                            label: availabilityZone,
                            value: availabilityZone
                        })),
                        'value'
                    )
                };
            }

            if (az1 === az2) {
                return {
                    key,
                    status: 'error',
                    message: 'Please select an different availability zone for the secondary sql node',
                    allowedValues: uniqBy(
                        isValidVpc.subnets?.map(({ availabilityZone }) => ({
                            label: availabilityZone,
                            value: availabilityZone
                        })),
                        'value'
                    )
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
                        'The availability zone that you provided seems to be incorrect, please choose an appropriate one',
                    allowedValues: uniqBy(
                        isValidVpc.subnets?.map(({ availabilityZone }) => ({
                            label: availabilityZone,
                            value: availabilityZone
                        })),
                        'value'
                    )
                };
            }

            return {
                value: az2
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
            message:
                'Key pair information is required to securely connect to your ec2 instance, please choose a key pair',
            allowedValues: keys.map(({ name }) => ({ label: name, value: name }))
        };
    }

    const isValidKey = keys?.find(({ name, id }) => name === keyName || id === keyName);

    if (!isValidKey) {
        return {
            key,
            status: 'error',
            message: 'Key pair that you provided seems to be incorrect, please try again',
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
            message: 'I would need to know the image that you want to use, please provide the image information',
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
            message: 'Image Id does not seem to be correct, please provide a valid one',
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
        message: 'Invalid value',
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
            message: 'Please select the instance type for the ec2 instance',
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
            message: 'Instance Type does not seem to be correct, please provide a valid one',
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
// To be Used by Yash PR

// async function validateFsx(credentialsId: string, region: string, vpcId: string, fsxId: string, key: string) {
//     logger.info('Validate FSX', credentialsId, region, key);
//     const { filesystems } = await getFSxFileSystemsList(credentialsId, region, vpcId);
//     if (!fsxId) {
//         return {
//             key,
//             status: 'error',
//             message: 'fsx information is required to process, Please select one',
//             allowedValues: filesystems.map(({ name, fileSystemId }) => ({
//                 label: name,
//                 value: fileSystemId
//             }))
//         };
//     }
//     const isValidFsx = filesystems?.find(filesystem => filesystem?.fileSystemId === fsxId);
//     if (!isValidFsx) {
//         return {
//             key,
//             status: 'error',
//             message: 'fsx information does not seems to correct, Please provide a valid one',
//             allowedValues: filesystems?.map(({ name, fileSystemId }) => ({
//                 label: name,
//                 value: fileSystemId
//             }))
//         };
//     }

//     return {
//         value: isValidFsx?.fileSystemId || null
//     };
// }

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
            message: 'Please select the domain dns name',
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
    const errorResponse = { status: 'error', message: 'Please provide the domain ip address', type: 'text' };
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
            message: `Please provide the value for ${key}`,
            type: key.toLowerCase().includes('password') ? 'password' : 'text'
        };
    }
    return { value: text };
}

function validateDbSize(size: number, key: string) {
    logger.debug('Validate DB Size', { size });
    if (!size || typeof size !== 'number' || (size < 1024 && size >= 1024 ** 3)) {
        return {
            key,
            status: 'error',
            message: `Please select a database size between 1024 to ${1024 ** 3}`,
            type: 'text'
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
            message: 'Please select a valid ThroughPut value',
            allowedValues: ThroughPut
        };
    }

    const isValid = ThroughPut.find(({ value }) => value === iops);
    if (!isValid) {
        return {
            key,
            status: 'error',
            message: 'Please select a valid ThroughPut value',
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
            message: 'Please select the security group',
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
            message: 'Please select the security group one',
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

async function validateFSxDeploymentMode(deploymentType: string, key: string) {
    logger.debug('Validate FSX Deployment Mode', { deploymentType });
    if (![SINGLE_AZ, MULTI_AZ].includes(deploymentType)) {
        return {
            key,
            status: 'error',
            message: 'Please select the FSx deployment type',
            allowedValues: [
                { label: 'Single Instance', value: SINGLE_AZ },
                { label: 'Failover Cluster Instance (FCI)', value: MULTI_AZ }
            ]
        };
    }
    return { value: deploymentType };
}

function checkFsxType(type: string, key: string) {
    if (type !== 'NEW' && type !== 'EXISTING') {
        return {
            key,
            status: 'error',
            message: 'Please select the FSx type',
            allowedValues: [
                { label: 'New', value: 'NEW' },
                { label: 'Existing', value: 'EXISTING' }
            ]
        };
    }
    return {
        value: type
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
    validateFSxDeploymentMode,
    validateCredentials,
    validateAdScenarioType,
    checkFsxType
};
