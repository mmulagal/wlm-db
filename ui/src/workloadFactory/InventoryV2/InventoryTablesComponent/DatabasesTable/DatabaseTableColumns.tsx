import { ReactNode } from 'react';
import { TFunction } from 'i18next';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import { DBType } from '../../../../utils/consts';
import { OraclePDBTableColDefs } from './OraclePDBTableColumns';
import { MssqlPgsqlDatabaseTableColDefs } from './MssqlPgsqlDatabaseTableColumns';
import { LunFilterOption } from '../../../../utils/types/workloadFactoryResourceTypes';

export function getDatabaseTableColumns({
    t,
    databaseTableRows,
    selectedHostType,
    setDialog,
    lunFilterOptions
}: {
    t: TFunction;
    databaseTableRows: any[];
    selectedHostType: string;
    setDialog?: (dialog: ReactNode) => void;
    lunFilterOptions?: LunFilterOption[];
}): ColumnProps[] {
    if (selectedHostType === DBType.ORACLE) {
        return OraclePDBTableColDefs({ t, databaseTableRows });
    }
    return MssqlPgsqlDatabaseTableColDefs({
        t,
        databaseTableRows,
        databaseType: selectedHostType,
        setDialog,
        lunFilterOptions
    });
}
