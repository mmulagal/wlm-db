export interface RegionRes {
    regions: {
        regionCode: string;
        regionName: string;
    };
}

export interface VpcRes {
    vpcs: {
        id: string;
        state: string;
        cidrBlock: string;
        tags: string;
        isDefault: boolean;
        name: string;
        subnets: [
            {
                id: string;
                state: string;
                vpcId: string;
                cidrBlock: string;
                availabilityZone: string;
                availableIps: 0;
                tags: string;
                name: string;
            }
        ];
        securityGroups: [
            {
                id: string;
                description: string;
                vpcId: string;
                ipPermissions: string;
                name: string;
            }
        ];
    };
}

export interface AdsRes {
    directories: [
        {
            id: string;
            dnsIpAddress: [string];
            launchTime: Date;
            domainName: string;
            shortName: string;
            ssoEnabled: boolean;
            status: string;
            type: string;
            vpcSettings: {
                vpcId: string;
                subnetIds: [string];
                availabilityZones: [string];
            };
        }
    ];
}

export interface AmisRes {
    amis: [
        {
            name: string;
            description: string;
            architecture: string;
            imageId: string;
            imageLocation: string;
            public: boolean;
            platform: string;
            platformDetails: string;
            state: string;
            hypervisor: string;
        }
    ];
}

export interface SnsTopicsRes {
    Topics: [
        {
            topicArn: string;
        }
    ];
}

export interface KmsKeysRes {
    keys: [
        {
            id: string;
            name: string;
            origin: string;
            state: string;
            expirationDate: string;
        }
    ];
    totalRecords: 0;
}

export interface KeyPairRes {
    keyPairs: [
        {
            id: string;
            name: string;
        }
    ];
}

export interface InstanceTypeRes {
    instanceTypes: [
        {
            instanceType: string;
            vCpus: number;
            ramInMib: number;
            iopsInMbps: number;
        }
    ];
}

export interface FsxnRes {
    filesystems: [
        {
            fileSystemId: string;
        }
    ];
}
