import { uniqBy } from 'lodash-es';
import { getAdsList } from '../../operations/aws/directory-service-operations';
import { getAmiList, getInstanceTypes, getKeyPairsList, getVpcsList } from '../../operations/aws/ec2-operations';
import { getFSxOntapRegionsList } from '../../operations/aws/ssm-operations';
import { getAllCredentials } from '../cloud-manager/credentials';
import getLogger from '../../utils/logger';

const logger = getLogger();

async function validateCredentials(credentialsId: string) {
    logger.debug('Validate Credentials', { credentialsId });
    const credentials = (await getAllCredentials('aws_assume_role')) || [];

    if (!credentialsId) {
        return {
            key: 'credentialsId',
            status: 'error',
            message:
                'I would need the credentialsId information to proceed further, please select a credentialsId of your choice',
            allowedValues: credentials.map(credential => ({
                label: credential.extra.name,
                value: credential.credentialsId
            }))
        };
    }

    const credentialsMatched = credentials?.filter(reg => reg.credentialsId === credentialsId);
    if (credentialsMatched.length !== 1) {
        return {
            key: 'region',
            status: 'error',
            message: `${
                credentialsMatched.length > 1
                    ? 'Mulitple credentials matching for you input, '
                    : 'The credentail that you have mentioned seems to be incorrect, '
            }please select an appropriate region`,
            allowedValues: credentialsMatched.length
                ? credentialsMatched.map(cred => ({ label: cred.extra.name, value: cred.credentialsId }))
                : credentialsMatched.map(cred => ({ label: cred.extra.name, value: cred.credentialsId }))
        };
    }

    return {
        value: credentialsMatched[0]?.credentialsId || null
    };
}

async function validateRegion(credentialsId: string, value: string) {
    logger.debug('Validate Region', { credentialsId, value });
    const { regions } = (await getFSxOntapRegionsList(credentialsId)) || [];

    if (!value) {
        return {
            key: 'region',
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
            key: 'region',
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
        value: regionsMatched[0]?.regionCode || null
    };
}

async function validateVpcId(
    credentialsId: string,
    region: string,
    vpcId: string,
    paramType: string,
    paramValue?: string
) {
    logger.debug('Validate VpcConfig', { credentialsId, region, vpcId, paramType, paramValue });
    const { vpcs } = await getVpcsList(credentialsId, region, paramType.includes('availabilityZone') ? 'subnet' : '');
    if (!vpcId) {
        return {
            key: 'vpcId',
            status: 'error',
            message: 'Please choose a VPC where you want db instances to be present',
            allowedValues: vpcs.map(vpc => ({ label: vpc.name, value: vpc.id }))
        };
    }

    const isValidVpc = vpcs?.find(vpc => vpc.id === vpcId);
    if (!isValidVpc) {
        return {
            key: 'vpcId',
            status: 'error',
            message: 'The VPC that you provided seems to be incorrect, please choose an appropriate one',
            allowedValues: vpcs.map(vpc => ({ label: vpc.name, value: vpc.id }))
        };
    }

    switch (paramType) {
        case 'vpcId':
            return { value: isValidVpc.id || null };
        case 'vpcCidr':
            return {
                value: isValidVpc.cidrBlock?.[0].CidrBlock || null
            };
        case 'availabilityZone1':
        case 'availabilityZone2': {
            if (paramValue) {
                return { value: paramValue };
            }
            return {
                key: paramType,
                status: 'error',
                message: `Please select an availability zone for ${
                    paramType === 'availabilityZone1' ? 'primary' : 'secondary'
                } the  sql node`,
                allowedValues: uniqBy(
                    isValidVpc.subnets?.map(({ availabilityZone }) => ({
                        label: availabilityZone,
                        value: availabilityZone
                    })),
                    'value'
                )
            };
        }
        default:
            return {};
    }
}

async function validateKeyName(credentialsId: string, region: string, keyName: string) {
    logger.debug('Validate Key Name', { credentialsId, region, keyName });
    const { keyPairs: keys } = await getKeyPairsList(credentialsId, region);
    if (!keyName) {
        return {
            key: 'keyPairName',
            status: 'error',
            message:
                'Key pair information is required to securely connect to your ec2 instance, please choose a key pair',
            allowedValues: keys.map(({ name }) => ({ label: name, value: name }))
        };
    }

    const isValidKey = keys?.find(key => key.name === keyName || key.id === keyName);

    if (!isValidKey) {
        return {
            key: 'keyPairName',
            status: 'error',
            message: 'Key pair that you provided seems to be incorrect, please try again',
            allowedValues: keys.map(({ name }) => ({ label: name, value: name }))
        };
    }
    return {
        value: isValidKey.name || null
    };
}

async function validateImageId(credentialsId: string, region: string, imageId: string) {
    logger.debug('Validate Image Id', { credentialsId, region, imageId });
    const { amis } = await getAmiList(credentialsId, region, 'Windows', 'SQL');
    if (!imageId) {
        return {
            key: 'sqlAmiId',
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
            key: 'sqlAmiId',
            status: isValidAmi ? 'success' : 'error',
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

async function validateInstanceType(credentialsId: string, region: string, workloadInstanceType: string) {
    logger.debug('Validate Instance Type', { credentialsId, region, workloadInstanceType });
    const { instanceTypes } = await getInstanceTypes(credentialsId, region);
    if (!workloadInstanceType) {
        return {
            key: 'workloadInstanceType',
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
            key: 'workloadInstanceType',
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

async function validateDomain(credentialsId: string, region: string, domainDnsname: string, paramType: string) {
    logger.debug('Validate Key Name', { credentialsId, region, domainDnsname, paramType });
    const { directories } = await getAdsList(credentialsId, region);
    if (!domainDnsname) {
        return {
            key: 'domainDnsname',
            status: 'error',
            message: 'Please select the domain dns name',
            allowedValues: uniqBy(
                directories.map(({ domainName }) => ({
                    label: domainName,
                    value: domainName
                })),
                'value'
            )
        };
    }

    const isValidDomain = directories?.find(({ domainName }) => domainName === domainDnsname);

    if (!isValidDomain) {
        return {
            key: 'domainDnsname',
            status: 'error',
            message: 'Domain Name is not correct, please provide a valid one',
            allowedValues: uniqBy(
                directories.map(({ domainName }) => ({
                    label: domainName,
                    value: domainName
                })),
                'value'
            )
        };
    }
    return {
        value:
            (paramType === 'domainDnsname' ? isValidDomain.domainName : isValidDomain?.dnsIpAddress?.join(',')) || null
    };
}

function validateText(text: string, paramType: string) {
    if (!text) {
        return {
            key: paramType,
            status: 'error',
            message: `Please provide the value for ${paramType}`,
            type: paramType.toLowerCase().includes('password') ? 'password' : 'text'
        };
    }
    return { value: text };
}

function validateDbSize(size: number) {
    logger.debug('Validate DB Size', { size });
    if (!size || typeof size !== 'number' || (size < 1024 && size >= 1024 ** 3)) {
        return {
            key: 'databaseSize',
            status: 'error',
            message: `Please select a database size between 1024 to ${1024 ** 3}`,
            type: 'text'
        };
    }

    return {
        value: size
    };
}

function validateThroughPut(iops: number) {
    logger.debug('Validate ThroughPut', { iops });
    const ThroughPut = [];
    for (let i = 0; i <= 5; i++) {
        ThroughPut.push({ label: `${128 * 2 ** i} Mbps`, value: 128 * 2 ** i });
    }
    if (!iops) {
        return {
            key: 'fsxVolThroughput',
            status: 'error',
            message: 'Please select a valid ThroughPut value',
            allowedValues: ThroughPut
        };
    }

    const isValid = ThroughPut.find(({ value }) => value === iops);
    if (!isValid) {
        return {
            key: 'fsxVolThroughput',
            status: 'error',
            message: 'Please select a valid ThroughPut value',
            allowedValues: ThroughPut
        };
    }
    return { value: isValid.value || null };
}

async function validateSecurityGroup(credentialsId: string, region: string, vpcId: string, securityGroup: string) {
    logger.debug('Validate Security Group', { credentialsId, region, securityGroup });
    const { vpcs } = await getVpcsList(credentialsId, region, 'securityGroup');

    const vpc = vpcs.find(({ id }) => id === vpcId);
    const secGrp = vpc?.securityGroups || [];

    if (!securityGroup) {
        return {
            key: 'ontapSgGroupId',
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
            key: 'ontapSgGroupId',
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

async function validateFSxDeploymentMode(deploymentType: string) {
    logger.debug('Validate FSX Deployment Mode', { deploymentType });
    if (!['SINGLE_AZ_1', 'MULTI_AZ_1'].includes(deploymentType)) {
        return {
            key: 'fsxDeploymentMode',
            status: 'error',
            message: 'Please select the FSx deployment type',
            allowedValues: [
                { label: 'SINGLE_AZ_1', value: 'SINGLE_AZ_1' },
                { label: 'MULTI_AZ_1', value: 'MULTI_AZ_1' }
            ]
        };
    }
    return { value: deploymentType };
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
    validateCredentials
};
