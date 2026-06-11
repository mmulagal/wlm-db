import { DsTypography, Table, useTable } from '@netapp/design-system';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import styles from './DialogContent.module.scss';
import { ASSESSMENT_CONFIG_NAMES, PATCH_SCAN_FIELD, WIZARD_TYPE } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import { useGetMissingPatchAssessmentDataQuery } from '../../../../utils/apiService';
import { getTableLazyLoadingComponentProps } from '../../../../common/Lib/Table/tableLazyLoadingProps';
import {
    createStandardDialog,
    createStandardNotesSection,
    createSection,
    createActionOptionSection
} from './DialogContentHelper';

type ComputeOracleDialogProps = {
    type?: string;
    createComputeConfigSection?: () => React.ReactNode;
    isWad?: boolean;
};

// Shape of a single host-OS patch row returned by /assessment/patch-scan for
// Oracle. Fields mirror the column accessors used in the table below.
interface OracleHostOsPatchDetail {
    cveIds?: string;
    title?: string;
    classification?: string;
    severity?: string;
}

interface OracleHostOsPatchInstance {
    ec2InstanceId?: string;
    ec2InstanceName?: string;
    missingPatchDetails?: OracleHostOsPatchDetail[];
}

interface OracleHostOsPatchResponse {
    ec2InstancesToPatch?: OracleHostOsPatchInstance[];
}

type OracleHostOsPatchRow = OracleHostOsPatchDetail & { instanceName?: string };

function ComputeOracleDialog({ type, createComputeConfigSection, isWad = false }: ComputeOracleDialogProps) {
    const { t } = useTranslation();
    const { selectedResourceId, selectedDatabaseInstance, selectedGwInstanceCredId, selectedGwInstanceRegionId } =
        useAppSelector(state => state.getWellOptimize);

    const isOsPatch = type === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH;
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
            field: PATCH_SCAN_FIELD.HOST_OS_PATCH
        },
        { skip: !hasIds || !isOsPatch }
    );

    const tableData = useMemo(() => {
        const response = missingPatchResponse as OracleHostOsPatchResponse | undefined;
        const instances: OracleHostOsPatchInstance[] = response?.ec2InstancesToPatch ?? [];
        const list = instances.flatMap(instance =>
            (instance.missingPatchDetails ?? []).map<OracleHostOsPatchRow>(patch => ({
                ...patch,
                instanceName: instance.ec2InstanceName
            }))
        );
        return list.map((item, index) => ({ ...item, id: String(index) }));
    }, [missingPatchResponse]);

    const EncryptionColDefs: ColumnProps[] = [
        {
            Header: t('databases.well-architect.cve-id'),
            accessor: 'cveIds',
            id: '1',
            isSortable: true,
            width: '137px'
        },
        {
            Header: t('databases.well-architect.package-name'),
            accessor: 'title',
            id: '2',
            isSortable: true,
            width: '262px'
        },
        {
            Header: t('databases.well-architect.update-type'),
            accessor: 'classification',
            id: '3',
            isSortable: true,
            width: '164px'
        },
        {
            Header: t('databases.well-architect.severity'),
            accessor: 'severity',
            id: '4',
            isSortable: true,
            width: '144px'
        }
    ];

    const tableProps = useTable({
        manageColumnsProps: {},
        isSorting: false,
        selectionType: 'none',
        columns: EncryptionColDefs,
        rows: tableData,
        pageSize: 50,
        isLazyLoading: isFetching
    });

    const tableComponentProps = getTableLazyLoadingComponentProps(t('databases.general.loading'));

    switch (type) {
        case ASSESSMENT_CONFIG_NAMES.TRANSPARENT_HUGEPAGES:
            return createStandardDialog(
                t,
                t('databases.well-architect.oracle-transparent-hugepages-action-summary'),
                t('databases.well-architect.oracle-transparent-hugepages-what-will-happen'),
                createStandardNotesSection(t, isWad),
                createComputeConfigSection?.(),
                false,
                isWad
            );
        case ASSESSMENT_CONFIG_NAMES.TCP_ADVANCED_OPTIONS:
            return createStandardDialog(
                t,
                t('databases.well-architect.oracle-tcp-action-summary'),
                t('databases.well-architect.oracle-tcp-what-will-happen'),
                createStandardNotesSection(t, isWad),
                createComputeConfigSection?.(),
                false,
                isWad
            );
        case ASSESSMENT_CONFIG_NAMES.FILESYSTEMS_IO_OPTIONS:
            return (
                <div className={styles['storage-tier-block']}>
                    {createSection(
                        t('databases.well-architect.action-summary'),
                        t('databases.well-architect.oracle-filesystem-io-options-action-summary')
                    )}
                    {createActionOptionSection(t('databases.well-architect.optimization-steps'), [
                        t('databases.well-architect.oracle-filesystem-io-options-optimization-step1'),
                        t('databases.well-architect.oracle-filesystem-io-options-optimization-step2'),
                        t('databases.well-architect.oracle-filesystem-io-options-optimization-step3')
                    ])}
                    {createSection(
                        t('databases.well-architect.notes'),
                        t('databases.well-architect.oracle-multipath-io-note')
                    )}
                </div>
            );
        case ASSESSMENT_CONFIG_NAMES.MULTIPATH_READCOUNT:
            return createStandardDialog(
                t,
                t('databases.well-architect.oracle-multiblock-readcount-action-summary'),
                t('databases.well-architect.oracle-multiblock-readcount-what-will-happen'),
                createStandardNotesSection(t, isWad),
                createComputeConfigSection?.(),
                false,
                isWad
            );
        case ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM_PATCH:
        default:
            return (
                <div className={styles['storage-tier-block']}>
                    {createSection(
                        t('databases.well-architect.action-summary'),
                        t('databases.well-architect.oracle-os-patch-action-summary')
                    )}

                    <div className={styles['first-section']}>
                        <div className={styles['heading-with-loader']}>
                            <DsTypography variant="Semibold_14">
                                {t('databases.well-architect.oracle-os-patch-missing-patches')}
                            </DsTypography>
                        </div>
                        <div className={styles.table}>
                            {/* @ts-ignore */}
                            <Table tableProps={tableProps} {...tableComponentProps} variant="innerTable" />
                        </div>
                    </div>

                    {createSection(
                        t('databases.well-architect.oracle-os-patch-action-required'),
                        t('databases.well-architect.oracle-os-patch-line1')
                    )}

                    {createActionOptionSection(t('databases.well-architect.oracle-os-patch-option1'), [
                        t('databases.well-architect.oracle-os-patch-option1-content1'),
                        t('databases.well-architect.oracle-os-patch-option1-content2'),
                        t('databases.well-architect.oracle-os-patch-option1-content3'),
                        t('databases.well-architect.oracle-os-patch-option1-content4'),
                        t('databases.well-architect.oracle-os-patch-option1-content5')
                    ])}

                    {createSection(t('databases.well-architect.oracle-os-patch-option2'))}
                    {createActionOptionSection(t('databases.well-architect.oracle-os-patch-option2-for-rhel'), [
                        t('databases.well-architect.oracle-os-patch-option2-for-rhel-content1'),
                        t('databases.well-architect.oracle-os-patch-option2-for-rhel-content2'),
                        t('databases.well-architect.oracle-os-patch-option2-for-rhel-content3'),
                        t('databases.well-architect.oracle-os-patch-option2-for-rhel-content4')
                    ])}

                    {createActionOptionSection(t('databases.well-architect.oracle-os-patch-option2-for-sles'), [
                        t('databases.well-architect.oracle-os-patch-option2-for-sles-content1'),
                        t('databases.well-architect.oracle-os-patch-option2-for-sles-content2'),
                        t('databases.well-architect.oracle-os-patch-option2-for-sles-content3'),
                        t('databases.well-architect.oracle-os-patch-option2-for-sles-content4')
                    ])}

                    {createSection(
                        t('databases.well-architect.note'),
                        t('databases.well-architect.oracle-os-patch-note')
                    )}
                </div>
            );
    }
}

export default ComputeOracleDialog;
