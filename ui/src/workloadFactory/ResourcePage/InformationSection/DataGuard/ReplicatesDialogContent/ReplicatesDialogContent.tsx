import { DsTypography, DsButton } from '@tlveng/wlm-ds';
import { useDialog, TooltipInfo } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import styles from '../../StorageCompute/LunsDialogContent/LunsDialogContent.module.scss';
import { DBType, WELL_ARCHITECTED_TABS, WLF_TABS } from '../../../../../utils/consts';
import { toSentenceCase } from '../../../../../utils/resourceUtils';
import {
    setBreadCrumbSelectedFrom,
    setRegisterHostType,
    setSelectedHeaderTab,
    setWizardOperationType
} from '../../../../../store/workloadFactory/inventoryV2Slice';
import {
    resetOracleResourceVisitedTabs,
    setSelectedOracleInnerPageTab
} from '../../../../../store/workloadFactory/oracleSlice';
import {
    setFSXId,
    setGwPageLoadInstanceData,
    setLandingFrom
} from '../../../../../store/workloadFactory/getWellOptimizeSlice';
import {
    resetWorkloadFactoryResourceData,
    setSelectedHostname,
    setSelectedResourcePageHostData
} from '../../../../../store/workloadFactory/workloadFactoryResourceSlice';
import { resetEiData } from '../../../../../store/workloadFactory/agenticAISlice';
import { useAppSelector } from '../../../../../store/storeHooks';
import DotComponent from '../../../../../common/DotComponent/DotComponent';

type AssociatedHost = {
    hostIp: string;
    serviceName: string;
    sidName: string;
    role: string;
    ec2InstanceId: string;
    hostName?: string;
    databaseHostId?: string;
    databaseInstanceId?: string;
};

const ReplicatesDialogContent = ({ resourceDetails }: any) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();
    const { closeDialog } = useDialog();

    const { selectedResourceCredId, selectedResourceRegionId } = useAppSelector(state => state.workloadFactoryResource);
    const { credIdFromJM, regionFromJM } = useAppSelector(state => state.getWellOptimize);

    const allAssociatedHosts = resourceDetails?.dataguardDetails?.associatedHosts || [];
    const isPrimaryNode = resourceDetails?.dataguardDetails?.isPrimaryNode === true;
    // Current database identity from the resource we're viewing (dbUniqueName is unique per instance)
    const currentDbUniqueName = resourceDetails?.dataguardDetails?.dbUniqueName;
    // Exclude the current database - show only other replicas
    const associatedHosts = allAssociatedHosts.filter((host: AssociatedHost) => {
        if (!currentDbUniqueName) return true;
        const isCurrentDb = host.serviceName === currentDbUniqueName || host.sidName === currentDbUniqueName;
        return !isCurrentDb;
    });

    const handleNavigateToOverview = (host: AssociatedHost) => {
        // Only navigate if databaseHostId is present (registered database)
        if (!host.databaseHostId) return;

        const credentialId = selectedResourceCredId || credIdFromJM;
        const regionId = selectedResourceRegionId || regionFromJM;

        // Use databaseHostId as resourceId for registered databases
        const resourceId = host.databaseHostId;

        // Set header and tab for Oracle
        dispatch(setSelectedHeaderTab(WLF_TABS.ORACLE_WELL_ARCHITECTED));
        dispatch(setSelectedOracleInnerPageTab(WELL_ARCHITECTED_TABS.OVERVIEW));

        // Set FSX ID
        dispatch(
            setFSXId({
                fsxId: resourceDetails?.databaseInstanceTopology?.fileSystemId,
                ec2InstanceId: host.ec2InstanceId,
                isInstanceStorageAsmManaged: resourceDetails?.isInstanceStorageAsmManaged
            })
        );

        dispatch(setBreadCrumbSelectedFrom(WLF_TABS.INVENTORY));
        dispatch(setLandingFrom(WLF_TABS.INVENTORY));

        // Set instance data for getWellOptimize slice
        dispatch(
            setGwPageLoadInstanceData({
                hostname: host.hostName,
                resourceId,
                instanceId: host?.databaseInstanceId,
                instanceName: host.serviceName,
                credId: credentialId,
                regionId
            })
        );

        // Reset and set resource page data
        dispatch(resetWorkloadFactoryResourceData());
        dispatch(setSelectedHostname(host.hostName));
        dispatch(
            setSelectedResourcePageHostData({
                resourceId,
                databaseInstanceId: host?.databaseInstanceId,
                databaseInstanceName: host.serviceName,
                credentialId,
                regionId
            })
        );

        dispatch(resetEiData({}));
        dispatch(setWizardOperationType('single'));
        dispatch(setRegisterHostType(DBType.ORACLE));

        // Reset visited tabs to trigger data fetch for new resource
        dispatch(resetOracleResourceVisitedTabs());

        closeDialog();
    };

    return (
        <div className={styles.tableWrapper}>
            <div className={styles.tableRow}>
                <DsTypography variant="Semibold_14" className={styles.tableCell}>
                    {t('databases.data-guard.host-name')}
                </DsTypography>
                <DsTypography variant="Semibold_14" className={styles.tableCell}>
                    {t('databases.data-guard.database-name')}
                </DsTypography>
                <DsTypography variant="Semibold_14" className={styles.tableCell}>
                    {t('databases.databases-table.oracle.headers.registration-status')}
                </DsTypography>
                <DsTypography variant="Semibold_14" className={styles.tableCell}>
                    {t('databases.data-guard.role')}
                </DsTypography>
            </div>
            {associatedHosts.map((host: AssociatedHost) => (
                <div key={host.serviceName} className={styles.tableRow}>
                    <DsTypography variant="Regular_14" className={styles.tableCell} title={host.hostName}>
                        {host.hostName}
                    </DsTypography>
                    <div className={styles.tableCell}>
                        {host?.databaseHostId ? (
                            <DsButton type="text" onClick={() => handleNavigateToOverview(host)}>
                                {host.serviceName}
                            </DsButton>
                        ) : (
                            <DsTypography variant="Regular_14">{host.serviceName}</DsTypography>
                        )}
                    </div>
                    <div className={styles.statusCell} role="cell">
                        {host?.databaseHostId ? (
                            <DotComponent color="var(--success)" value={t('databases.general.registered')} />
                        ) : (
                            <DotComponent color="var(--toggle-off-bg)" value={t('databases.data-guard.unregistered')} />
                        )}
                    </div>
                    <div className={styles.roleCell}>
                        <DsTypography variant="Regular_14" title={toSentenceCase(host.role)}>
                            {toSentenceCase(host.role)}
                        </DsTypography>
                        {!isPrimaryNode && host.role?.toUpperCase() === 'UNKNOWN' && (
                            <TooltipInfo trigger="hover" isAppendedToBody>
                                <DsTypography variant="Regular_13">
                                    {t('databases.data-guard.unknown-role-tooltip')}
                                </DsTypography>
                            </TooltipInfo>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
};

export default ReplicatesDialogContent;
