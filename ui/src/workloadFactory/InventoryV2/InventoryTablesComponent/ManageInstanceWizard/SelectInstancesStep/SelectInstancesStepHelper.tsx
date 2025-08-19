import { DBType } from '../../../../../utils/consts';

export const getSelectInstancesPageContentKeys = (engineType: string) => {
    if (engineType === DBType.ORACLE) {
        return {
            content1: 'databases.register-flow.select-instance-page-content1-oracle',
            content2: 'databases.register-flow.select-instance-page-content2-oracle'
        };
    }
    // Default: MSSQL
    return {
        content1: 'databases.register-flow.select-instance-page-content1',
        content2: 'databases.register-flow.select-instance-page-content2'
    };
};
