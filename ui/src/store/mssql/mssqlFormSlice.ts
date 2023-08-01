import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { GENERAL } from '../../utils/appConstants';

const initialState: any = {
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
        selectedSecurityType: GENERAL.USE_AN_EXISTING_SECURITY,
        selectedExistingSecurityGroup: ''
    },
    operatingSystem: {
        selectedOperatingSystem: GENERAL.WIN_SERVER_2016
    },
    dbVersion: GENERAL.SQL_SERVER_2016,
    dbDeploymentModel: GENERAL.FAILOVER_CLUSTER,
    dbEdition: GENERAL.SQL_SERVER_STANDARD_EDITION,
    license: {
        selectedLicenseType: GENERAL.LICENSE_INCLUDED_AMI,
        selectedLicenseId: '',
        selectedCustomAMI: ''
    },
    dbName: '',
    dbCredentials: {
        name: '',
        password: ''
    },
    keyPair: {
        selectedKeyPair: null
    },
    activeDirectory: {
        domainName: '',
        domainAddress: '',
        userName: '',
        password: ''
    },
    instanceType: '',
    fsxN: {
        fsxNType: GENERAL.CREATE_NEW_FSXN,
        fsxNName: '',
        fsxNExistingName: '',
        fsxNUserName: '',
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
    cloudWatch: false,
    encryption: {
        encryptionType: GENERAL.ENCRYPTION_SELECT_FROM_ACCOUNT,
        selectedRow: null,
        encryptionArn: ''
    }
};

const mssqlFormSlice = createSlice({
    name: 'mssqlForm',
    initialState,
    reducers: {
        setSelectedCredentials(state, action: PayloadAction<any>) {
            state.awsAccount.selectedCredential = action.payload;
        },
        setSelectedOperatingSystem(state, action: PayloadAction<any>) {
            state.operatingSystem.selectedOperatingSystem = action.payload;
        },
        //Security Group
        setSelectedSecurityGroup(state, action: PayloadAction<any>) {
            state.securityGroup.selectedSecurityType = action.payload;
        },
        setSelectedExistingSecurityGroup(state, action: PayloadAction<any>) {
            state.securityGroup.selectedExistingSecurityGroup = action.payload;
        },
        //DB version
        setDBVersion(state, action: PayloadAction<any>) {
            state.dbVersion = action.payload;
        },
        //Region and VPC
        setSelectedRegionData(state, action: PayloadAction<any>) {
            state.regionAndVpc.selectedRegion = action.payload;
        },
        setSelectedVPC(state, action: PayloadAction<any>) {
            state.regionAndVpc.selectedVPC = action.payload;
        },
        //availabilityZones
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
        //dbDeploymentModel
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
        //DB Name
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
        //AD
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
        //Instance Type
        setInstanceType(state, action: PayloadAction<any>) {
            state.instanceType = action.payload;
        },
        //FSXN
        setFsxNType(state, action: PayloadAction<any>) {
            state.fsxN.fsxNType = action.payload;
        },
        setFsxNName(state, action: PayloadAction<any>) {
            state.fsxN.fsxNName = action.payload;
        },
        setFsxNUserName(state, action: PayloadAction<any>) {
            state.fsxN.fsxNUserName = action.payload;
        },
        setFsxNPassword(state, action: PayloadAction<any>) {
            state.fsxN.fsxNPassword = action.payload;
        },
        setExistingFsxnName(state, action: PayloadAction<any>) {
            state.fsxN.fsxNExistingName = action.payload;
        },
        //Storage Capacity
        setStorageCapacity(state, action: PayloadAction<any>) {
            state.storageCapacity.capacity = action.payload;
        },
        setStorageUnit(state, action: PayloadAction<any>) {
            state.storageCapacity.unit = action.payload;
        },
        //Provisioned IOPS
        setProvisionedType(state, action: PayloadAction<any>) {
            state.provisionedIOPS.provisionedType = action.payload;
        },
        setProvisionedIOPSValue(state, action: PayloadAction<any>) {
            state.provisionedIOPS.IOPSValue = action.payload;
        },
        //Throughput
        setThroughputValue(state, action: PayloadAction<any>) {
            state.throughput = action.payload;
        },
        //SNS
        setSNSState(state, action: PayloadAction<any>) {
            state.simpleNotification.snsState = action.payload;
        },
        setSNSARN(state, action: PayloadAction<any>) {
            state.simpleNotification.snsARN = action.payload;
        },
        //Cloud watch
        setCloudWatch(state, action: PayloadAction<any>) {
            state.cloudWatch = action.payload;
        },
        //Encryption
        setEncryptionType(state, action: PayloadAction<any>) {
            state.encryption.encryptionType = action.payload;
        },
        setEncryptionRow(state, action: PayloadAction<any>) {
            state.encryption.selectedRow = action.payload;
        },
        setEncryptionARN(state, action: PayloadAction<any>) {
            state.encryption.encryptionArn = action.payload;
        }
    }
});

export const {
    setSelectedADDomainName,
    setSelectedADDomainAddress,
    setSelectedADUserName,
    setSelectedADPassword,
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
    setFsxNUserName,
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
    setDBName,
    setDBCredentialsName,
    setDBCredentialsPassword,
    setSelectedAzNode1,
    setSelectedSubnetNode1,
    setSelectedAzNode2,
    setSelectedSubnetNode2,
    setSelectedKeyPair,
    setInstanceType
} = mssqlFormSlice.actions;
export default mssqlFormSlice;
