import { TFunction } from 'i18next';
import { ColumnProps } from '../../../../common/Lib/Table/Table';
import { DBType } from '../../../../utils/consts';
import { OracleHostTableColDefs } from './OracleHostTableColumns';
import { MssqlPgsqlHostTableColDefs } from './MssqlPgsqlHostTableColumns';

export function getHostTableColumns({
    t,
    hostTableRows,
    selectedHostType
}: {
    t: TFunction;
    hostTableRows: any[];
    selectedHostType: string;
}): ColumnProps[] {
    if (selectedHostType === DBType.ORACLE) {
        return OracleHostTableColDefs({ t, hostTableRows });
    }
    return MssqlPgsqlHostTableColDefs({ t, hostTableRows });
}
