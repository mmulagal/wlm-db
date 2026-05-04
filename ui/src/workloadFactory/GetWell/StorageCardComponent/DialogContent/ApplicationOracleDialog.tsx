import { DsTypography, Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { DsButton } from '@tlveng/wlm-ds';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES, PATCH_SCAN_FIELD, WIZARD_TYPE } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import { useGetMissingPatchAssessmentDataQuery } from '../../../../utils/apiService';
import { getTableLazyLoadingComponentProps } from '../../../../common/Lib/Table/tableLazyLoadingProps';
import {
    createActionOptionSection,
    createCodeBoxWithCopy,
    createContentWithBullets,
    createSection
} from './DialogContentHelper';

type ApplicationOracleDialogProps = {
    type: string;
};

const ApplicationOracleDialog = ({ type }: ApplicationOracleDialogProps) => {
    const { t } = useTranslation();
    const { selectedResourceId, selectedDatabaseInstance, selectedGwInstanceCredId, selectedGwInstanceRegionId } =
        useAppSelector(state => state.getWellOptimize);

    const isSecurityPatch = type === ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH;
    const hasIds = Boolean(
        selectedGwInstanceCredId && selectedGwInstanceRegionId && selectedResourceId && selectedDatabaseInstance
    );

    const { data: missingPatchResponse, isFetching } = useGetMissingPatchAssessmentDataQuery(
        {
            dbType: WIZARD_TYPE.ORACLE,
            credentialId: selectedGwInstanceCredId,
            regionId: selectedGwInstanceRegionId,
            databaseHostId: selectedResourceId,
            instanceId: selectedDatabaseInstance,
            field: PATCH_SCAN_FIELD.ORACLE_SECURITY_PATCH
        },
        { skip: !hasIds || !isSecurityPatch }
    );

    const tableData = useMemo(() => {
        // Backend returns { ec2InstancesToPatch: [{ missingPatchDetails: [...] }, ...] };
        // flatten across instances into a single list of patches for the table.
        const instances = (missingPatchResponse as any)?.ec2InstancesToPatch ?? [];
        const list = instances.flatMap((inst: any) => inst?.missingPatchDetails ?? []);
        return list.map((item: any, index: number) => ({ ...item, id: index }));
    }, [missingPatchResponse]);

    const patchColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architect.oracle-critical-patch-cve-id'),
            accessor: 'cveId',
            id: '1',
            isSortable: true,
            width: '120px'
        },
        {
            Header: t('databases.well-architect.oracle-critical-patch-component'),
            accessor: 'component',
            id: '2',
            isSortable: true,
            width: '150px'
        },
        {
            Header: t('databases.well-architect.oracle-critical-patch-description'),
            accessor: 'description',
            id: '3',
            isSortable: true,
            width: '280px'
        },
        {
            Header: t('databases.well-architect.oracle-critical-patch-published-date'),
            accessor: 'releaseDate',
            id: '4',
            isSortable: true,
            width: '162px'
        }
    ];

    const tableProps = useTable({
        manageColumnsProps: {},
        isSorting: false,
        selectionType: 'none',
        columns: patchColDefs,
        rows: tableData,
        pageSize: 50,
        isLazyLoading: isFetching
    });

    const tableComponentProps = getTableLazyLoadingComponentProps(t('databases.general.loading'));
    const openSecurityAlertsTab = () => {
        const url = 'https://www.oracle.com/security-alerts/';
        window.open(url, '_blank', 'noopener');
    };

    const setContent = () => {
        switch (type) {
            case ASSESSMENT_CONFIG_NAMES.ORACLE_SECURITY_PATCH:
                return (
                    <>
                        {createSection(
                            t('databases.well-architect.action-summary'),
                            t('databases.well-architect.oracle-critical-patch-action-summary')
                        )}

                        <div className={styles['first-section']}>
                            <div className={styles['heading-with-loader']}>
                                <DsTypography variant="Semibold_14">
                                    {t('databases.well-architect.oracle-critical-patch-security-patches')}
                                </DsTypography>
                            </div>
                            <div className={styles.table}>
                                {/* @ts-ignore */}
                                <Table tableProps={tableProps} {...tableComponentProps} variant="innerTable" />
                            </div>
                        </div>

                        {createSection(
                            t('databases.well-architect.oracle-critical-patch-action-required'),
                            t('databases.well-architect.oracle-critical-patch-line1')
                        )}

                        {createActionOptionSection('', [
                            <span className={styles['step-with-link']}>
                                {t('databases.well-architect.oracle-critical-patch-step1')}
                                <DsButton type="link" onClick={openSecurityAlertsTab}>
                                    {t('databases.well-architect.oracle-critical-patch-step1-link')}
                                </DsButton>
                            </span>,
                            t('databases.well-architect.oracle-critical-patch-step2'),
                            t('databases.well-architect.oracle-critical-patch-step3'),
                            t('databases.well-architect.oracle-critical-patch-step4'),
                            <>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.oracle-critical-patch-step5-before')}
                                </DsTypography>
                                {createCodeBoxWithCopy(
                                    t('databases.well-architect.oracle-critical-patch-step5-command'),
                                    t('databases.general.copied-to-clipboard')
                                )}
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.oracle-critical-patch-step5-after')}
                                </DsTypography>
                            </>,
                            t('databases.well-architect.oracle-critical-patch-step6'),
                            <>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.oracle-critical-patch-step7-before')}
                                </DsTypography>
                                {createCodeBoxWithCopy(
                                    t('databases.well-architect.oracle-critical-patch-step7-command'),
                                    t('databases.general.copied-to-clipboard')
                                )}
                            </>,
                            <>
                                <DsTypography variant="Regular_14">
                                    {t('databases.well-architect.oracle-critical-patch-step8-before')}
                                </DsTypography>
                                {createCodeBoxWithCopy(
                                    t('databases.well-architect.oracle-critical-patch-step8-command'),
                                    t('databases.general.copied-to-clipboard')
                                )}
                            </>,
                            t('databases.well-architect.oracle-critical-patch-step9')
                        ])}

                        {createSection(
                            t('databases.well-architect.note'),
                            createContentWithBullets([
                                t('databases.well-architect.oracle-critical-patch-note1'),
                                t('databases.well-architect.oracle-critical-patch-note2')
                            ])
                        )}
                    </>
                );
            default:
                break;
        }
    };

    return <div className={styles['storage-tier-block']}>{setContent()}</div>;
};

export default ApplicationOracleDialog;
