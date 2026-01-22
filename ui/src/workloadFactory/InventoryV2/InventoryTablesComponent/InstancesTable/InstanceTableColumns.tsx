import { TFunction } from 'i18next';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import { DBType } from '../../../../utils/consts';
import { getOracleDatabaseColumnsList } from './OracleDatabaseColumnsList';
import { getMssqlInstanceTableColumns } from './MssqlInstanceColumnList';
import { getPgsqlInstanceTableColumns } from './PgsqlInstanceColumnList';

export function getInstanceTableColumns({
    t,
    updatedTableData,
    selectedHostType,
    isBulkSelectionActive
}: {
    t: TFunction;
    updatedTableData: any[];
    selectedHostType: string;
    isBulkSelectionActive?: boolean;
}): ColumnProps[] {
    if (selectedHostType === DBType.ORACLE) {
        return getOracleDatabaseColumnsList({ t, updatedTableData });
    }
    if (selectedHostType === DBType.POSTGRESQL) {
        return getPgsqlInstanceTableColumns({ t, updatedTableData });
    }
    if (selectedHostType === DBType.MSSQL) {
        return getMssqlInstanceTableColumns({ t, updatedTableData, isBulkSelectionActive });
    }
    // Default to MSSQL columns
    return getMssqlInstanceTableColumns({ t, updatedTableData, isBulkSelectionActive });
}
