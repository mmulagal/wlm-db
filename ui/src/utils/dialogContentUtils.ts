import { DBType, ENGINE_TYPES } from './consts';

const engineTypeText = (databaseType: string): string => {
    switch (databaseType) {
        case DBType.MSSQL:
            return ENGINE_TYPES.MSSQL;
        case DBType.ORACLE:
            return ENGINE_TYPES.ORACLE;
        case DBType.POSTGRESQL:
            return ENGINE_TYPES.POSTGRESQL;
        default:
            return '';
    }
};

export default engineTypeText;
