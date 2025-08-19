import { DBType } from '../../../../../../utils/consts';

// Utility function to check if authentication is required
export const isAuthRequiredForInstance = (instanceData: any, hostType: string) => {
    if (hostType === DBType.ORACLE) {
        const isDefault = instanceData?.isDefaultAuthentication;
        const isOracleAuth = instanceData?.oracleServerAuthentication;
        if (isDefault === false) {
            return false; // Auth is not required for non-default Oracle instances
        }
        if (isDefault === true) {
            // If isDefaultAuthentication is set to true, authentication is required only if oracleServerAuthentication is false
            return !isOracleAuth;
        }
    } else {
        // For MSSQL and others: no auth if all auth fields are falsy
        return authenticationFields[(hostType as keyof typeof authenticationFields) || DBType.MSSQL]?.every(
            field => !instanceData?.[field]
        );
    }
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
        instances?.forEach(item => {
            if (!item?.data?.oracleServerAuthentication) {
                oracleServerAuthentication = false;
            }
            if (!item?.data?.isDefaultAuthentication) {
                isDefaultAuthentication = false;
            }
        });
        return {
            oracleServerAuthentication,
            isDefaultAuthentication,
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
