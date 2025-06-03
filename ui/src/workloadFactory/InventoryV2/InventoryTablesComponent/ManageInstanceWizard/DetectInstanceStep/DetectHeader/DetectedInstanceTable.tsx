import { DsTypography, Table, useTable, Popover } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import styles from './DetectHeader.module.scss';
import { ColumnProps } from '@netapp/design-system/dist/components/Table';
import { ReactComponent as Success } from '../../../../../../assets/success.svg';
import { ReactComponent as Cross } from '../../../../../../assets/black-cross.svg';
import { ReactComponent as TooltipIcon } from '../../../../../../assets/tooltipGrey.svg';
import { useAppSelector } from '../../../../../../store/storeHooks';
import { useEffect, useState } from 'react';
import { GENERAL } from '../../../../../../utils/appConstants';
import {
    checkOverallManageState,
    getPermissionState,
    hasMissingPowershell7,
    missingModules
} from '../../ManageInstanceUtils';
import DotComponent from '../../../../../../common/DotComponent/DotComponent';
import { MANAGE_STATES } from '../../../../../../utils/consts';
import TooltipCard from '../../../../../../common/TooltipCard/TooltipCard';

const DetectedInstanceTable = () => {
    const { t } = useTranslation();
    const { selectedMultiDetectInstances } = useAppSelector(state => state.inventoryV2);
    const [tableData, setTableData] = useState<any>([]);

    const manageCheck = (instance: any) => {
        let manageCheckObj: any = {
            installMissingAWS: false,
            installMissingAWSList: [],
            installMissingPowershell: false,
            assessment: GENERAL.NOT_AVAILABLE,
            remediation: GENERAL.NOT_AVAILABLE,
            dbcreation: GENERAL.NOT_AVAILABLE,
            sandbox: GENERAL.NOT_AVAILABLE,
            ec2InstanceId: '',
            region: '',
            credentialsId: '',
            databaseInstanceName: '',
            overallState: GENERAL.NOT_AVAILABLE,
            readyCount: 0
        };

        let manageReadinessData: any = null;
        if (!instance?.data?.windowsAuthentication && !instance?.data?.sqlServerAuthentication) {
            manageReadinessData = instance?.manageReadiness;
        } else {
            manageReadinessData = instance?.data?.manageReadiness;
        }
        if (manageReadinessData) {
            let missingModulesList = missingModules(manageReadinessData);
            let assessment = getPermissionState('assessment', manageReadinessData);
            let remediation = getPermissionState('remediation', manageReadinessData);
            let dbcreation = getPermissionState('dbcreation', manageReadinessData);
            let sandbox = getPermissionState('sandbox', manageReadinessData);
            let overallState = checkOverallManageState(assessment, remediation, dbcreation, sandbox);
            let readyCount = 0;
            let perRowState = [
                {
                    key: t('databases.register-flow.review-well-architected-issues-and-recommendations'),
                    value: assessment
                },
                {
                    key: t('databases.register-flow.fix-well-architected-issues'),
                    value: remediation
                },
                {
                    key: t('databases.register-flow.create-database'),
                    value: dbcreation
                },
                {
                    key: t('databases.register-flow.create-database-copies-sandbox'),
                    value: sandbox
                }
            ];
            if (assessment === MANAGE_STATES.READY) {
                readyCount += 1;
            }
            if (remediation === MANAGE_STATES.READY) {
                readyCount += 1;
            }
            if (dbcreation === MANAGE_STATES.READY) {
                readyCount += 1;
            }
            if (sandbox === MANAGE_STATES.READY) {
                readyCount += 1;
            }
            manageCheckObj = {
                installMissingAWS: missingModulesList.length > 0 ? true : false,
                installMissingAWSList: missingModulesList,
                installMissingPowershell: hasMissingPowershell7(manageReadinessData),
                assessment: assessment,
                remediation: remediation,
                dbcreation: dbcreation,
                sandbox: sandbox,
                ec2InstanceId: instance?.data?.ec2InstanceId,
                region: instance?.data?.regionId,
                credentialsId: instance?.data?.credentialId,
                databaseInstanceName: instance?.data?.databaseInstanceName,
                overallState: overallState,
                readyCount: readyCount + '/4',
                perRowState: perRowState
            };
            return manageCheckObj;
        }
        return manageCheckObj;
    };

    useEffect(() => {
        let newTableData: any = [];
        selectedMultiDetectInstances?.forEach((item: any) => {
            const manageStates = manageCheck(item);
            newTableData.push({
                id: item?.id,
                instanceName: item?.data?.databaseInstanceName,
                authenticationStatus: item?.authorized
                    ? t('databases.general.authenticated')
                    : t('databases.general.unauthenticated'),
                hostName: item?.data?.name,
                readinessStatus: manageStates?.overallState,
                readyCount: manageStates?.readyCount,
                perRowState: manageStates?.perRowState || []
            });
        });
        setTableData(newTableData);
    }, [selectedMultiDetectInstances]);

    const ColDefs: ColumnProps[] = [
        {
            id: '1',
            Header: t('databases.register-flow.detect-instance-table-col.instance-name'),
            accessor: 'instanceName',
            width: '180px',
            isSortable: true
        },
        {
            id: '2',
            Header: t('databases.register-flow.detect-instance-table-col.host-name'),
            accessor: 'hostName',
            width: '180px',
            filterOptions: 'auto',
            isSortable: true
        },
        {
            id: '3',
            Header: t('databases.register-flow.detect-instance-table-col.authenticated-status'),
            accessor: 'authenticationStatus',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: any) => {
                if (cellData === t('databases.general.authenticated')) {
                    return <DotComponent color={'var(--success)'} value={cellData} />;
                }
                if (cellData === t('databases.general.unauthenticated')) {
                    return <DotComponent color={'var(--toggle-off-bg)'} value={cellData} />;
                }
            }
        },
        {
            id: '4',
            Header: t('databases.register-flow.detect-instance-table-col.readiness-status'),
            accessor: 'readinessStatus',
            width: '200px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {cellData === MANAGE_STATES.READY ? <Success /> : <Cross />}
                        <DsTypography variant="Regular_14">{cellData}</DsTypography>
                    </div>
                );
            }
        },
        {
            id: '5',
            Header: t('databases.register-flow.detect-instance-table-col.prerequisite-check'),
            accessor: 'readyCount',
            width: '188px',
            filterOptions: 'auto',
            renderCell: (cellData: any, rowData: any) => {
                return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Popover
                            popoverClass={''}
                            children={<TooltipCard listObj={rowData?.perRowState} registerFlow={true} />}
                            trigger="click"
                            isAppendedToBody={false}
                            container={<TooltipIcon />}
                        />
                        <DsTypography variant="Regular_14">{cellData}</DsTypography>
                    </div>
                );
            }
        }
    ];

    const tableProps = useTable({
        //@ts-ignore
        selectAllProps: false,
        //@ts-ignore
        manageColumnsProps: false,
        isSorting: false,
        selectionType: 'none',
        columns: ColDefs,
        rows: tableData,
        isHorizontalScroll: false,
        isVerticalScroll: true,
        isLazyLoading: false
    });

    return (
        <div className={styles.table}>
            <Table
                //@ts-ignore
                tableProps={tableProps}
                isDoubleRow={true}
                variant="innerTable"
            />
        </div>
    );
};

export default DetectedInstanceTable;
