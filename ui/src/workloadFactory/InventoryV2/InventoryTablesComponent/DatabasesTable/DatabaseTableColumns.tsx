import { TFunction } from 'i18next';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import { DBType } from '../../../../utils/consts';
import { OraclePDBTableColDefs } from './OraclePDBTableColumns';
import { MssqlPgsqlDatabaseTableColDefs } from './MssqlPgsqlDatabaseTableColumns';

export function getDatabaseTableColumns({
    t,
    databaseTableRows,
    selectedHostType
}: {
    t: TFunction;
    databaseTableRows: any[];
    selectedHostType: string;
}): ColumnProps[] {
    if (selectedHostType === DBType.ORACLE) {
        return OraclePDBTableColDefs({ t, databaseTableRows });
    }
    return MssqlPgsqlDatabaseTableColDefs({ t, databaseTableRows, databaseType: selectedHostType });
}
