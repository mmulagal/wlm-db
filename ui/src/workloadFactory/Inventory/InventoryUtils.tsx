import { DsFlashingDotsLoader, TooltipInfo, Typography } from '@netapp/design-system';
import { GENERAL } from '../../utils/appConstants';
import { formatFractionalNumber, isAwsBackupEnabled } from '../../utils/utilityFunctions';
import EstimatedCostPopover from './EstimatedCostPopover/EstimatedCostPopover';
import { DETECT_HOST_VAR, FSX_DEPLOYMENT_MODE } from '../../utils/consts';
import CommonStyles from '../../utils/CommonStyles.module.scss';

export const renderProtectionColumn = (cellData: any, rowData: any, styles: any) => {
    const isLoading = rowData?.loading;
    const protectionData = rowData?.protection;
    const totalDbCount = rowData?.databaseCount || 0;
    let protectedChk = false;
    if (
        isAwsBackupEnabled(rowData) ||
        protectionData?.isFsxOntapSnapshotsEnabled ||
        protectionData?.isSqlNativeEnabled
    ) {
        protectedChk = true;
    }

    let protectionDbCount = 0;
    let protectionPercent = 0;
    if (isAwsBackupEnabled(rowData) || protectionData?.isFsxOntapSnapshotsEnabled) {
        protectionDbCount = totalDbCount;
        protectionPercent = 100;
    } else if (protectionData?.isSqlNativeEnabled) {
        protectionDbCount = protectionData?.protectedDatabases || 0;
        protectionPercent =
            totalDbCount > 0 && protectionDbCount <= totalDbCount ? (protectionDbCount / totalDbCount) * 100 : 0;
    }

    return (
        <>
            {protectionData && (
                <div className={styles.colText}>
                    {protectedChk && (
                        <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                            {protectionDbCount +
                                GENERAL.PROTECTION_TOOLTIP[0] +
                                totalDbCount +
                                GENERAL.PROTECTION_TOOLTIP[1]}
                        </TooltipInfo>
                    )}
                    <div className={styles.protection}>
                        <Typography variant="Regular_14">
                            {protectedChk
                                ? formatFractionalNumber(protectionPercent) + '% ' + GENERAL.PROTECTION
                                : GENERAL.NOT_PROTECTED}
                        </Typography>
                    </div>
                </div>
            )}
            {!protectionData && isLoading && <DsFlashingDotsLoader />}
            {!protectionData && !isLoading && GENERAL.NOT_AVAILABLE}
        </>
    );
};

export const renderEstimatedCost = (cellData: any, rowData: any, styles: any) => {
    const costData = rowData?.estimatedUsageCost;
    const totalCost = +rowData?.totalCost;
    return (
        <>
            {costData && (
                <div className={styles.cost}>
                    <TooltipInfo className={styles.tooltipClass} onVisibleChange={function noRefCheck() {}}>
                        {EstimatedCostPopover({ ...costData, totalCost: totalCost })}
                    </TooltipInfo>
                    <Typography variant="Regular_14">{`$ ${formatFractionalNumber(totalCost, 2)}`}</Typography>
                </div>
            )}
            {!costData && rowData?.loading && <DsFlashingDotsLoader />}
            {!costData && !rowData?.loading && GENERAL.NOT_AVAILABLE}
        </>
    );
};

export const renderAllocatedCapacity = (cellData: any, rowData: any) => {
    return (
        <>
            {!rowData?.loading && (cellData || cellData === 0 ? cellData : GENERAL.NOT_AVAILABLE)}
            {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
        </>
    );
};

export const renderFileSystemType = (cellData: any, rowData: any) => {
    const typeList: string[] = [];
    rowData?.sqlServerInstances?.[0]?.storage?.map((storageObj: any) => {
        if (storageObj.type === DETECT_HOST_VAR.FSXN && !typeList.includes(GENERAL.FSX_FOR_ONTAP)) {
            typeList.push(GENERAL.FSX_FOR_ONTAP);
        }
        if (storageObj.type === DETECT_HOST_VAR.EBS && !typeList.includes(GENERAL.EBS)) {
            typeList.push(GENERAL.EBS);
        }
        if (storageObj.type === DETECT_HOST_VAR.FSXW && !typeList.includes(GENERAL.FSX_FOR_WINDOWS)) {
            typeList.push(GENERAL.FSX_FOR_WINDOWS);
        }
    });
    return typeList.length ? typeList.join(', ') : cellData || GENERAL.NOT_AVAILABLE;
};

export const renderCellData = (cellData: any, rowData: any, styles: any) => {
    return (
        <>
            {cellData && (
                <Typography variant="Regular_13" className={styles.colText}>
                    {cellData}
                </Typography>
            )}
            {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
            {!cellData && cellData !== 0 && !rowData?.loading && GENERAL.NOT_AVAILABLE}
        </>
    );
};

export const renderInstanceName = (cellData: any, rowData: any, styles: any) => {
    let instanceIds: any = [];
    let instanceNames: any = [];
    cellData?.ec2Details?.map((row: any) => {
        instanceIds.push(row?.id);
        instanceNames.push(row?.name);
    });
    return (
        <>
            {instanceNames.length > 0 ? (
                <div className={styles.colText}>
                    {instanceIds.length > 0 && (
                        <TooltipInfo onVisibleChange={function noRefCheck() {}}>
                            ID: {instanceIds.join(',')}
                        </TooltipInfo>
                    )}
                    <Typography variant="Regular_14">{instanceNames.join(',')}</Typography>
                </div>
            ) : (
                rowData?.ec2InstanceName || GENERAL.NOT_AVAILABLE
            )}
        </>
    );
};

export const renderDeploymentModel = (cellData: string, rowData: any) => {
    return (
        <>
            {cellData && cellData === 'FCI' ? GENERAL.FAILOVER_CLUSTER_INSTANCES : cellData}
            {!cellData && rowData?.loading && <DsFlashingDotsLoader />}
            {!cellData && !rowData?.loading && GENERAL.NOT_AVAILABLE}
        </>
    );
};

export const renderUnmanagedHostName = (cellData: string, rowData: any, styles: any) => {
    const status = rowData?.sqlServerInstances?.[0]?.sqlServerState;
    const name = rowData?.sqlServerInstances?.[0]?.sqlServerName || rowData?.name;
    return (
        <div>
            <Typography variant="Semibold_14">{name || GENERAL.NOT_AVAILABLE}</Typography>
            <div className={styles.firstColText}>
                {status === GENERAL.JOB_STATUS_RUNNING && (
                    <div className={`${styles.statusIcon} ${styles['circle']} ${styles['up']}`}></div>
                )}
                {status !== GENERAL.JOB_STATUS_RUNNING && (
                    <div className={`${styles.statusIcon} ${styles['circle']} ${styles['down']}`}></div>
                )}
                <Typography variant="Regular_13">
                    {status
                        ? status === GENERAL.JOB_STATUS_RUNNING
                            ? GENERAL.DB_HOST_UP
                            : GENERAL.DB_HOST_DOWN
                        : GENERAL.NOT_AVAILABLE}
                </Typography>
                <div className={CommonStyles.separator} />
                <Typography variant="Regular_13">{GENERAL.MSSQL}</Typography>
            </div>
        </div>
    );
};

export const renderUnmanagedAZ = (cellData: string, rowData: any, styles: any) => {
    const azList = rowData?.sqlServerInstances?.[0]?.deploymentTypes?.[0]?.zones
        ? rowData?.sqlServerInstances?.[0]?.deploymentTypes?.[0]?.zones.join(',')
        : '';
    const deploymentType = rowData?.sqlServerInstances?.[0]?.deploymentTypes?.[0]?.type;
    return (
        <>
            {deploymentType && (
                <div className={styles.colText}>
                    <TooltipInfo onVisibleChange={function noRefCheck() {}}>{azList}</TooltipInfo>
                    <Typography variant="Regular_14">
                        {deploymentType === FSX_DEPLOYMENT_MODE.SINGLE_AZ_1
                            ? GENERAL.SINGLE_AZ
                            : deploymentType === FSX_DEPLOYMENT_MODE.MULTI_AZ_1
                            ? GENERAL.MULTI_AZ
                            : ''}
                    </Typography>
                </div>
            )}
            {!deploymentType && GENERAL.NOT_AVAILABLE}
        </>
    );
};
