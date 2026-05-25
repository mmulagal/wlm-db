import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GENERAL, SELECT_CONFIG } from '../../utils/appConstants';
import { FORM_OPTIONS, FSXADMIN, SQL_DEPLOYMENT_MODE, SQL_USERNAME } from '../../utils/consts';

export const initialMssqlState: any = {
    awsAccount: {
        selectedCredential: null
    },
    regionAndVpc: {
        selectedRegion: null,
        selectedVPC: null
    },
    availabilityZones: {
        selectedAzNode1: null,
        selectedSubnetNode1: null,
        selectedAzNode2: null,
        selectedSubnetNode2: null
    },
    securityGroup: {
        selectedSecurityType: '',
        selectedExistingSecurityGroup: []
    },
    operatingSystem: {
        label: GENERAL.WIN_SERVER_2016,
        value: GENERAL.WIN_SERVER_2016_VERSION
    },
    dbVersion: {
        value: GENERAL.SQL_SERVER_2019_VERSION,
        label: GENERAL.SQL_SERVER_2019
    },
    dbDeploymentModel: {
        label: GENERAL.FAILOVER_CLUSTER,
        value: SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE
    },
    dbEdition: {
        label: GENERAL.SQL_SERVER_STANDARD_EDITION,
        value: GENERAL.SQL_SERVER_STANDARD
    },
    license: {
        selectedLicenseType: FORM_OPTIONS.LICENSE_AMI,
        selectedLicenseId: null,
        selectedCustomAMI: null
    },
    sqlServerCollation: {},
    dbName: '',
    dbCredentials: {
        name: '',
        password: ''
    },
    keyPair: {
        selectedKeyPair: null
    },
    activeDirectory: {
        scenarioType: '',
        domainName: null,
        domainAddress: '',
        userName: '',
        password: '',
        preferredDomainController: '',
        preferredOUPath: '',
        targetADGroup: '',
        organizationalUnit: 'default',
        adGroup: 'default',
        useManagedServiceAccount: false
    },
    instanceType: '',
    fsxN: {
        fsxNType: FORM_OPTIONS.FSXN_NEW,
        fsxNName: '',
        fsxNNewUserName: FSXADMIN,
        fsxNExistingName: null,
        fsxNExistingUserName: '',
        fsxNPassword: ''
    },
    storageCapacity: {
        capacity: '',
        unit: ''
    },
    provisionedIOPS: {
        provisionedType: GENERAL.AUTOMATIC,
        IOPSValue: ''
    },
    throughput: '',
    simpleNotification: {
        snsState: false,
        snsARN: ''
    },
    cloudWatch: true,
    snapshotPolicyToggle: true,
    encryption: {
        encryptionType: GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT,
        selectedRow: null,
        encryptionArn: ''
    },
    tags: [{ key: '', value: '' }],
    saveConfigName: '',
    selectConfig: SELECT_CONFIG.EASY_CREATE,
    loadConfig: ''
};

const mssqlFormSlice = createSlice({
    name: 'mssqlForm',
    initialState: initialMssqlState,
    reducers: {
        setSnapshotPolicyToggle(state, action: PayloadAction<any>) {
            state.snapshotPolicyToggle = action.payload;
        },
        setSelectedCredentials(state, action: PayloadAction<any>) {
            state.awsAccount.selectedCredential = action.payload;
        },
        setSelectedOperatingSystem(state, action: PayloadAction<any>) {
            state.operatingSystem = action.payload;
        },
        // Security Group
        setSelectedSecurityGroup(state, action: PayloadAction<any>) {
            state.securityGroup.selectedSecurityType = action.payload;
        },
        setSelectedExistingSecurityGroup(state, action: PayloadAction<any>) {
            state.securityGroup.selectedExistingSecurityGroup = action.payload;
        },
        // DB version
        setDBVersion(state, action: PayloadAction<any>) {
            state.dbVersion = action.payload;
        },
        // Region and VPC
        setSelectedRegionData(state, action: PayloadAction<any>) {
            state.regionAndVpc.selectedRegion = action.payload;
        },
        setSelectedVPC(state, action: PayloadAction<any>) {
            state.regionAndVpc.selectedVPC = action.payload;
        },
        // availabilityZones
        setSelectedAzNode1(state, action: PayloadAction<any>) {
            state.availabilityZones.selectedAzNode1 = action.payload;
        },
        setSelectedSubnetNode1(state, action: PayloadAction<any>) {
            state.availabilityZones.selectedSubnetNode1 = action.payload;
        },
        setSelectedAzNode2(state, action: PayloadAction<any>) {
            state.availabilityZones.selectedAzNode2 = action.payload;
        },
        setSelectedSubnetNode2(state, action: PayloadAction<any>) {
            state.availabilityZones.selectedSubnetNode2 = action.payload;
        },
        // dbDeploymentModel
        setSelectedDBDeploymentModel(state, action: PayloadAction<any>) {
            state.dbDeploymentModel = action.payload;
        },
        // dbEdition
        setSelectedDBEdition(state, action: PayloadAction<any>) {
            state.dbEdition = action.payload;
        },
        // license
        setSelectedLicenseType(state, action: PayloadAction<any>) {
            state.license.selectedLicenseType = action.payload;
        },
        setSelectedLicenseId(state, action: PayloadAction<any>) {
            state.license.selectedLicenseId = action.payload;
        },
        setSelectedCustomAMI(state, action: PayloadAction<any>) {
            state.license.selectedCustomAMI = action.payload;
        },
        setSqlServerCollation(state, action: PayloadAction<any>) {
            state.sqlServerCollation = action.payload;
        },
        // DB Name
        setDBName(state, action: PayloadAction<any>) {
            state.dbName = action.payload;
        },
        // databaseCredentials
        setDBCredentialsName(state, action: PayloadAction<any>) {
            state.dbCredentials.name = action.payload;
        },
        setDBCredentialsPassword(state, action: PayloadAction<any>) {
            state.dbCredentials.password = action.payload;
        },
        // keyPair
        setSelectedKeyPair(state, action: PayloadAction<any>) {
            state.keyPair.selectedKeyPair = action.payload;
        },
        // AD
        setSelectedADScenarioType(state, action: PayloadAction<any>) {
            state.activeDirectory.scenarioType = action.payload;
        },
        setSelectedADDomainName(state, action: PayloadAction<any>) {
            state.activeDirectory.domainName = action.payload;
        },
        setSelectedADDomainAddress(state, action: PayloadAction<any>) {
            state.activeDirectory.domainAddress = action.payload;
        },
        setSelectedADUserName(state, action: PayloadAction<any>) {
            state.activeDirectory.userName = action.payload;
        },
        setSelectedADPassword(state, action: PayloadAction<any>) {
            state.activeDirectory.password = action.payload;
        },
        setActiveDirectoryFields(state, action: PayloadAction<Partial<typeof state.activeDirectory>>) {
            state.activeDirectory = { ...state.activeDirectory, ...action.payload };
        },
        // Reset AD advanced fields
        resetADAdvancedFields(state) {
            state.activeDirectory = {
                ...state.activeDirectory,
                preferredDomainController: '',
                preferredOUPath: '',
                targetADGroup: '',
                useManagedServiceAccount: false
            };
        },
        // Instance Type
        setInstanceType(state, action: PayloadAction<any>) {
            state.instanceType = action.payload;
        },
        // FSXN
        setFsxNType(state, action: PayloadAction<any>) {
            state.fsxN.fsxNType = action.payload;
        },
        setFsxNName(state, action: PayloadAction<any>) {
            state.fsxN.fsxNName = action.payload;
        },
        setFsxNExistingUserName(state, action: PayloadAction<any>) {
            state.fsxN.fsxNExistingUserName = action.payload;
        },
        setFsxNPassword(state, action: PayloadAction<any>) {
            state.fsxN.fsxNPassword = action.payload;
        },
        setExistingFsxnName(state, action: PayloadAction<any>) {
            state.fsxN.fsxNExistingName = action.payload;
        },
        // Storage Capacity
        setStorageCapacity(state, action: PayloadAction<any>) {
            state.storageCapacity.capacity = action.payload;
        },
        setStorageUnit(state, action: PayloadAction<any>) {
            state.storageCapacity.unit = action.payload;
        },
        // Provisioned IOPS
        setProvisionedType(state, action: PayloadAction<any>) {
            state.provisionedIOPS.provisionedType = action.payload;
        },
        setProvisionedIOPSValue(state, action: PayloadAction<any>) {
            state.provisionedIOPS.IOPSValue = action.payload;
        },
        // Throughput
        setThroughputValue(state, action: PayloadAction<any>) {
            state.throughput = action.payload;
        },
        // SNS
        setSNSState(state, action: PayloadAction<any>) {
            state.simpleNotification.snsState = action.payload;
        },
        setSNSARN(state, action: PayloadAction<any>) {
            state.simpleNotification.snsARN = action.payload;
        },
        // Cloud watch
        setCloudWatch(state, action: PayloadAction<any>) {
            state.cloudWatch = action.payload;
        },
        // Encryption
        setEncryptionType(state, action: PayloadAction<any>) {
            state.encryption.encryptionType = action.payload;
        },
        setEncryptionRow(state, action: PayloadAction<any>) {
            state.encryption.selectedRow = action.payload;
        },
        setEncryptionARN(state, action: PayloadAction<any>) {
            state.encryption.encryptionArn = action.payload;
        },
        setTags(state, action: PayloadAction<any>) {
            state.tags = action.payload;
        },
        // Save Config
        setSaveConfigName(state, action: PayloadAction<any>) {
            state.saveConfigName = action.payload.trim();
        },
        // Select config
        setSelectConfig(state, action: PayloadAction<any>) {
            state.selectConfig = action.payload;
        },
        // load config update
        setLoadConfig(state, action: PayloadAction<any>) {
            state.loadConfig = action.payload;
        },
        // Update full form
        setMssqlForm(state, action: PayloadAction<any>) {
            const payload = { ...action.payload };
            // Normalize selectedExistingSecurityGroup to always be an array.
            // Old saved configs stored a single object; new configs store an array.
            const sg = payload.securityGroup?.selectedExistingSecurityGroup;
            if (sg && !Array.isArray(sg)) {
                payload.securityGroup = {
                    ...payload.securityGroup,
                    selectedExistingSecurityGroup: [sg]
                };
            }
            return { ...state, ...payload };
        }
    }
});

export const {
    setSelectConfig,
    setSaveConfigName,
    setSelectedADScenarioType,
    setSelectedADDomainName,
    setSelectedADDomainAddress,
    setSelectedADUserName,
    setSelectedADPassword,
    setActiveDirectoryFields,
    resetADAdvancedFields,
    setEncryptionType,
    setEncryptionRow,
    setEncryptionARN,
    setCloudWatch,
    setSNSState,
    setSNSARN,
    setProvisionedType,
    setThroughputValue,
    setProvisionedIOPSValue,
    setStorageCapacity,
    setStorageUnit,
    setFsxNType,
    setExistingFsxnName,
    setFsxNName,
    setFsxNExistingUserName,
    setFsxNPassword,
    setSelectedCredentials,
    setSelectedOperatingSystem,
    setSelectedSecurityGroup,
    setSelectedExistingSecurityGroup,
    setDBVersion,
    setSelectedRegionData,
    setSelectedVPC,
    setSelectedDBDeploymentModel,
    setSelectedDBEdition,
    setSelectedLicenseType,
    setSelectedLicenseId,
    setSelectedCustomAMI,
    setSqlServerCollation,
    setDBName,
    setDBCredentialsName,
    setDBCredentialsPassword,
    setSelectedAzNode1,
    setSelectedSubnetNode1,
    setSelectedAzNode2,
    setSelectedSubnetNode2,
    setSelectedKeyPair,
    setInstanceType,
    setTags,
    setLoadConfig,
    setMssqlForm,
    setSnapshotPolicyToggle
} = mssqlFormSlice.actions;
export default mssqlFormSlice;
