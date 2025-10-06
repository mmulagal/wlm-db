import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import { Button, useDialog } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';

import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../assets/error-icon.svg';
import styles from './StorageCompute.module.scss';
import { formatString } from '../../../../utils/utilityFunctions';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import LunsDialogContent from './LunsDialogContent/LunsDialogContent';
import { DBType } from '../../../../utils/consts';

type accordionType = {
    handleToggle: any;
    openKey: string;
    resourceDetails: any;
    resourceLoading: boolean;
    engineType: string;
};

const StorageCompute = ({ handleToggle, openKey, resourceDetails, resourceLoading, engineType }: accordionType) => {
    const { setDialog } = useDialog();

    const { t } = useTranslation();

    const handleLUNSDialog = () => {
        setDialog(
            <DialogComponent
                header={
                    resourceDetails?.storage?.fsxn?.protocol?.[0] !== 'iSCSI'
                        ? t('databases.resource-overview.associated_volumes_2')
                        : t('databases.resource-overview.associated_luns')
                }
                content={<LunsDialogContent resourceDetails={resourceDetails} engineType={engineType} />}
                primaryButton={GENERAL.CLOSE}
                callback={() => {}}
                customClass={styles.protectionDialog}
            />
        );
    };
    const contentArea = () => (
        <>
            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.DB_INSTANCE_TYPE}
                </DsTypography>
                <DsTypography
                    variant="Regular_14"
                    className={commonStyles.valueCSS}
                    title={resourceDetails?.topology?.ec2Details?.[0].instanceType || ''}
                >
                    {resourceDetails?.topology?.ec2Details?.[0].instanceType}
                </DsTypography>
            </div>

            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.FILE_SYS_NAME}
                </DsTypography>
                <DsTypography
                    variant="Regular_14"
                    className={commonStyles.valueCSS}
                    title={resourceDetails?.topology?.fileSystemName || ''}
                >
                    {resourceDetails?.topology?.fileSystemName}
                </DsTypography>
            </div>

            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.FILE_SYS_ID}
                </DsTypography>
                <DsTypography
                    variant="Regular_14"
                    className={commonStyles.valueCSS}
                    title={resourceDetails?.topology?.fileSystemId || ''}
                >
                    {resourceDetails?.topology?.fileSystemId}
                </DsTypography>
            </div>

            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.FILE_SYS_TYPE}
                </DsTypography>
                <DsTypography
                    variant="Regular_14"
                    className={commonStyles.valueCSS}
                    title={resourceDetails?.topology?.fileSystemType || ''}
                >
                    {resourceDetails?.topology?.fileSystemType}
                </DsTypography>
            </div>

            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.FILE_SYS_STATUS}
                </DsTypography>
                <div className={styles.statusIconClass}>
                    {resourceDetails?.topology?.fileSystemStatus &&
                    resourceDetails?.topology?.fileSystemStatus.toLowerCase() === 'available' ? (
                        <Success />
                    ) : (
                        <Failure />
                    )}
                    <DsTypography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.topology?.fileSystemStatus || ''}
                    >
                        {formatString(resourceDetails?.topology?.fileSystemStatus)}
                    </DsTypography>
                </div>
            </div>

            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.STORAGE_CAPACITY_INFO}
                </DsTypography>
                <DsTypography variant="Regular_14">
                    {resourceDetails?.topology?.fileSystemStorageCapacity
                        ? `${resourceDetails.topology.fileSystemStorageCapacity} GiB`
                        : ''}
                </DsTypography>
            </div>

            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.FILE_SYS_DP_TYPE}
                </DsTypography>
                <DsTypography variant="Regular_14">{resourceDetails?.topology?.fileSystemDeploymentMode}</DsTypography>
            </div>

            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {GENERAL.FSX_THROUGHPUT_TYPE}
                </DsTypography>
                <DsTypography variant="Regular_14">
                    {resourceDetails?.topology?.fileSystemThroughputCapacity
                        ? `${resourceDetails.topology.fileSystemThroughputCapacity} MB/s`
                        : ''}
                </DsTypography>
            </div>

            {engineType === DBType.MSSQL && (
                <div className={commonStyles.row}>
                    <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                        {t('databases.resource-overview.associated_luns')}:
                    </DsTypography>
                    <DsTypography variant="Regular_14" className={commonStyles.valueCSS}>
                        <div className={commonStyles.luns}>
                            {resourceDetails?.databaseInstanceTopology?.storageSummary &&
                            resourceDetails?.databaseInstanceTopology?.storageSummary?.volumes &&
                            resourceDetails?.databaseInstanceTopology?.storageSummary?.volumes.length ? (
                                <>
                                    <DsTypography variant="Regular_14">
                                        {resourceDetails?.storage?.fsxn?.protocol?.[0] !== 'iSCSI'
                                            ? resourceDetails?.databaseInstanceTopology?.storageSummary?.totalVolumes
                                            : resourceDetails?.databaseInstanceTopology?.storageSummary?.totalLuns}
                                    </DsTypography>
                                    <Button variant="text" onClick={handleLUNSDialog}>
                                        View
                                    </Button>
                                </>
                            ) : (
                                t('databases.general.not-available')
                            )}
                        </div>
                    </DsTypography>
                </div>
            )}

            {engineType === DBType.ORACLE && (
                <div className={commonStyles.row}>
                    <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                        {resourceDetails?.storage?.fsxn?.protocol[0] !== 'iSCSI'
                            ? t('databases.resource-overview.associated_volumes_2')
                            : t('databases.resource-overview.associated_luns')}
                        :
                    </DsTypography>
                    <DsTypography variant="Regular_14" className={commonStyles.valueCSS}>
                        <div className={commonStyles.luns}>
                            {resourceDetails?.databaseInstanceTopology?.storageSummary &&
                            resourceDetails?.databaseInstanceTopology?.storageSummary?.volumes &&
                            resourceDetails?.databaseInstanceTopology?.storageSummary?.volumes.length ? (
                                <>
                                    <DsTypography variant="Regular_14">
                                        {resourceDetails?.storage?.fsxn?.protocol?.[0] !== 'iSCSI'
                                            ? resourceDetails?.databaseInstanceTopology?.storageSummary?.totalVolumes
                                            : resourceDetails?.databaseInstanceTopology?.storageSummary?.totalLuns}
                                    </DsTypography>
                                    <Button variant="text" onClick={handleLUNSDialog}>
                                        View
                                    </Button>
                                </>
                            ) : (
                                t('databases.general.not-available')
                            )}
                        </div>
                    </DsTypography>
                </div>
            )}
        </>
    );
    return (
        <div className="">
            <DbAccordion
                resourceLoading={resourceLoading}
                heading="Storage & Compute"
                toggle={handleToggle}
                open={openKey === 'Storage & Compute'}
                content={contentArea()}
            />
        </div>
    );
};

export default StorageCompute;
