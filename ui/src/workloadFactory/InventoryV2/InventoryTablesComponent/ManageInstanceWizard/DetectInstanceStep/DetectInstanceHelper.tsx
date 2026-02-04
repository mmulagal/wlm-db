import { TFunction } from 'i18next';
import { DBType, MANAGE_STATES } from '../../../../../utils/consts';
import { ReactComponent as InstanceName } from '../../../../../assets/instance-name.svg';
import { ReactComponent as Database } from '../../../../../assets/Database.svg';

export const getInstanceHeaderContent = (type: string, t: TFunction) => {
    switch (type) {
        case DBType.ORACLE:
            return {
                nameLabel: t('databases.register-flow.instance-header.database-name'),
                statusLabel: t('databases.register-flow.instance-header.database-status'),
                selectedLabel: t('databases.register-flow.selected-databases'),
                icon: <Database />
            };
        case DBType.MSSQL:
            return {
                nameLabel: t('databases.register-flow.instance-header.instance-name'),
                statusLabel: t('databases.register-flow.instance-header.instance-status'),
                selectedLabel: t('databases.register-flow.selected-instances'),
                icon: <InstanceName />
            };
        default:
            return {
                nameLabel: t('databases.register-flow.instance-header.instance-name'),
                statusLabel: t('databases.register-flow.instance-header.instance-status'),
                selectedLabel: t('databases.register-flow.selected-instances'),
                icon: <InstanceName />
            };
    }
};

export const authenticationFieldsTexts = {
    [DBType.MSSQL]: {
        heading: 'databases.register-flow.detect-mssql-heading',
        usernameLabel: 'databases.register-flow.detect-mssql-username',
        passwordLabel: 'databases.register-flow.detect-mssql-password'
    },
    [DBType.ORACLE]: {
        heading: 'databases.register-flow.detect-oracle-heading',
        usernameLabel: 'databases.register-flow.detect-oracle-username',
        passwordLabel: 'databases.register-flow.detect-oracle-password'
    }
};

export const readinessString = (cellData: any, t: TFunction) => {
    if (cellData === MANAGE_STATES.READY) {
        return t('databases.log-analyzer.readiness-status-complete');
    }
    return cellData;
};
