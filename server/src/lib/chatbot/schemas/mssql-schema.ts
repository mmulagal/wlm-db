// User Intent from the query/request
type Intent = {
    intent: FunctionToRun | Query;
};
// If the user if asking a query, give a proper reply
type Query = {
    type: 'Query';
    response: string; // The response from the chatbot
};

type FunctionToRun = DeployMsSql;

// Parameters for MS SQL Deployment, use undefined as default value
type DeployMsSqlParams = {
    deploymentEnvironment?: string;
    credentialsId?: string;
    sqlDeploymentMode?: string;
    region?: string; // region name or code as provided by the user
    vpcId?: string; // VPC id for the instance
    vpcCidr?: string; // VPC CIDR block
    availabilityZone1?: string; // Availability Zone 1
    privateSubnet1Id?: string; // Private Subnet 1 Id
    availabilityZone2?: string; // Availability Zone 2
    privateSubnet2Id?: string; // Private Subnet 2 Id
    routeTable1Id?: string;
    routeTable2Id?: string;
    fsxType?: string;
    workloadInstanceType?: string;
    keyPairName?: string;
    adScenarioType?: string;
    domainUsername?: string;
    domainPassword?: string;
    domainDnsname?: string;
    dnsIpaddress?: string;
    securityGroupId?: string;
    sqlServerName?: string;
    sqlAmiId?: string;
    serviceAccountName?: string;
    serviceAccountPassword?: string;
    fsxDeploymentMode?: string;
    fsxUsername?: string;
    fsxPassword?: string;
    databaseSize?: number;
    fsxVolThroughput?: number;
    fsxIOPS?: number;
    encryptionKey?: string;
    ontapSgGroupId?: string;
    fsxFileSystemId?: string;
    enableCloudWatch?: boolean;
    tags?: Array<{ key: string; value: string }>;
};

// Deploy MS SQL
type DeployMsSql = {
    type: 'DeployMsSql';
    params: DeployMsSqlParams;
};

export { Intent };
