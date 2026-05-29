import { Table, DsTypography, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '../../../../store/storeHooks';
import {
    DBType,
    PGSQL_HA_SECURITY_GROUP_RULES,
    PGSQL_STANDALONE_SECURITY_GROUP_RULES,
    MSSQL_SECURITY_GROUP_RULES,
    SQL_DEPLOYMENT_MODE
} from '../../../../utils/consts';
import styles from './SecurityGroup.module.scss';

const SecurityGroupRulesTable = () => {
    const { t } = useTranslation();
    const deploymentModel = useAppSelector(state => state.mssqlForm.dbDeploymentModel?.value);
    const selectedDatabaseType = useAppSelector((state: any) => state.postgreForm.selectedDatabaseType);
    const isFci = deploymentModel === SQL_DEPLOYMENT_MODE.FAILOVER_CLUSTER_VALUE;
    const isPgsql = selectedDatabaseType === DBType.POSTGRESQL;

    const columns: ColumnProps[] = [
        {
            Header: t('databases.general.security-group-rules-col-type'),
            accessor: 'type',
            id: 'type',
            isSortable: true,
            width: '280px'
        },
        {
            Header: t('databases.general.security-group-rules-col-protocol'),
            accessor: 'protocol',
            id: 'protocol',
            isSortable: true,
            width: '200px'
        },
        {
            Header: t('databases.general.security-group-rules-col-port-range'),
            accessor: 'portRange',
            id: 'portRange',
            isSortable: true,
            width: '227px'
        }
    ];

    const rows = useMemo(() => {
        let rules = MSSQL_SECURITY_GROUP_RULES;
        if (isPgsql) {
            rules = isFci ? PGSQL_HA_SECURITY_GROUP_RULES : PGSQL_STANDALONE_SECURITY_GROUP_RULES;
        }
        return rules.map((item, index) => ({ ...item, id: String(index) }));
    }, [isPgsql, isFci]);

    const tableProps = useTable({
        // @ts-ignore
        selectAllProps: false,
        // @ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        columns,
        rows,
        pageSize: rows.length
    });

    return (
        <div className={styles.rulesDialogContent}>
            {!isPgsql && (
                <DsTypography variant="Regular_14" className={styles.descriptionText}>
                    {t('databases.general.security-group-rules-dialog-description')}
                </DsTypography>
            )}
            {!isPgsql && isFci && (
                <DsTypography variant="Regular_14" className={styles.descriptionText}>
                    {t('databases.general.security-group-rules-dialog-description-fci')}
                </DsTypography>
            )}
            {isPgsql && (
                <DsTypography variant="Regular_14" className={styles.descriptionText}>
                    {t('databases.general.security-group-rules-dialog-description-pgsql')}
                </DsTypography>
            )}
            <DsTypography variant="Regular_14" className={styles.descriptionText}>
                {t('databases.general.security-group-rules-dialog-description-2')}
            </DsTypography>
            <DsTypography variant="Regular_14" className={styles.descriptionText}>
                {t('databases.general.security-group-rules-dialog-description-3')}
            </DsTypography>
            {/* @ts-ignore */}
            <Table tableProps={tableProps} variant="innerTable" />
        </div>
    );
};

export default SecurityGroupRulesTable;
