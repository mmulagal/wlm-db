import { DBType } from '../../../../../../utils/consts';

// Utility function to check if authentication is required
export const isAuthRequiredForInstance = (instanceData: any, hostType: string) => {
    if (hostType === DBType.ORACLE) {
        const isDefault = instanceData?.isDefaultAuthentication;
        const isOracleAuth = instanceData?.oracleServerAuthentication;

        // For Oracle instances:
        // - If isDefaultAuthentication is true, no auth is required
        // - If isDefaultAuthentication is false, check oracleServerAuthentication
        // - If both are undefined/null, conservatively require authentication
        if (isDefault === true) {
            return false; // Auth is not required for default Oracle instances
        }
        if (isDefault === false) {
            // If isDefaultAuthentication is set to false, authentication is required only if oracleServerAuthentication is false
            return !isOracleAuth;
        }
        // Handle undefined/null cases - require authentication if oracleServerAuthentication is not explicitly true
        return !isOracleAuth;
    }
    // For MSSQL and others: no auth if all auth fields are falsy
    return (
        !instanceData?.sqlServerAuthentication &&
        !instanceData?.windowsAuthentication &&
        !instanceData?.windowsDomainUserAuthentication
    );
};

// Utility function to check if ASM authentication is required
export const isAsmAuthRequired = (instanceData: any, hostType: string) => {
    if (hostType === DBType.ORACLE) {
        return instanceData?.isInstanceStorageAsmManaged === true && instanceData?.asmAuthentication === false;
    }
    return false;
};

export const getBulkDetectChecksHelper = (instances: any[], hostType: string) => {
    let fsxId = false;
    let isFsxRegistered = true;

    // FSx checks are common for all host types
    instances?.forEach(item => {
        if (item?.data?.fsxId && !item?.data?.isFsxRegistered) {
            fsxId = true;
            isFsxRegistered = false;
        }
    });

    if (hostType === DBType.ORACLE) {
        let oracleServerAuthentication = true;
        let isDefaultAuthentication = true;
        // Setting by default as false as ASM is required only when it is true so will be set accordingly below
        let isInstanceStorageAsmManaged = false;
        let asmAuthentication = true;
        instances?.forEach(item => {
            if (!item?.data?.oracleServerAuthentication) {
                oracleServerAuthentication = false;
            }
            if (!item?.data?.isDefaultAuthentication) {
                isDefaultAuthentication = false;
            }
            if (item?.data?.isInstanceStorageAsmManaged === true) {
                isInstanceStorageAsmManaged = true;
            }
            if (item?.data?.asmAuthentication === false) {
                asmAuthentication = false;
            }
        });
        return {
            oracleServerAuthentication,
            isDefaultAuthentication,
            isInstanceStorageAsmManaged,
            asmAuthentication,
            fsxId,
            isFsxRegistered,
            hostType: DBType.ORACLE
        };
    }
    // MSSQL
    let sqlServerAuthentication = true;
    let windowsAuthentication = true;
    let windowsDomainUserAuthentication = true;
    instances?.forEach(item => {
        if (!item?.data?.sqlServerAuthentication && !item?.data?.windowsAuthentication) {
            sqlServerAuthentication = false;
            windowsAuthentication = false;
        }
        if (!item?.data?.windowsDomainUserAuthentication) {
            windowsDomainUserAuthentication = false;
        }
    });
    return {
        sqlServerAuthentication,
        windowsAuthentication,
        windowsDomainUserAuthentication,
        fsxId,
        isFsxRegistered,
        hostType: hostType || DBType.MSSQL
    };
};

const authenticationFields = {
    MSSQL: ['sqlServerAuthentication', 'windowsAuthentication', 'windowsDomainUserAuthentication'],
    ORACLE: ['oracleServerAuthentication', 'isDefaultAuthentication']
};

export const getSelectDropdownLabels = (engineType: string) => {
    if (engineType === DBType.ORACLE) {
        return {
            title: 'databases.register-flow.select-databases',
            selected: 'databases.register-flow.selected-databases',
            placeholder: 'databases.register-flow.select-databases'
        };
    }
    // Default: MSSQL
    return {
        title: 'databases.register-flow.instances',
        selected: 'databases.register-flow.instances-selected',
        placeholder: 'databases.register-flow.select-instances'
    };
};
