import { useTranslation } from 'react-i18next';
import { DsTypography } from '@tlveng/wlm-ds';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../assets/error-icon.svg';
import styles from './StorageCompute.module.scss';
import { formatString } from '../../../../utils/utilityFunctions';

type accordionType = {
    handleToggle: any;
    openKey: string;
};

const StorageCompute = ({ handleToggle, openKey }: accordionType) => {
    const resourceDetails = useAppSelector(state => state.workloadFactoryResource.resourceDetails);
    const { t } = useTranslation();
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

            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {t('databases.resource-overview.associated_volumes')}
                </DsTypography>
                <DsTypography
                    variant="Regular_14"
                    className={commonStyles.valueCSS}
                    title={
                        resourceDetails?.databaseInstanceTopology?.ontapVolumes
                            ?.map((volume: any) => volume.name)
                            .join(', ') || ''
                    }
                >
                    {resourceDetails?.databaseInstanceTopology?.ontapVolumes &&
                    resourceDetails?.databaseInstanceTopology?.ontapVolumes?.length
                        ? resourceDetails?.databaseInstanceTopology?.ontapVolumes
                              ?.map((volume: any) => volume.name)
                              .join(', ')
                        : t('databases.general.not-available')}
                </DsTypography>
            </div>

            <div className={commonStyles.row}>
                <DsTypography variant="Semibold_14" className={commonStyles.heading}>
                    {t('databases.resource-overview.associated_luns')}
                </DsTypography>
                <DsTypography
                    variant="Regular_14"
                    className={commonStyles.valueCSS}
                    title={
                        resourceDetails?.databaseInstanceTopology?.ontapLuns &&
                        resourceDetails?.databaseInstanceTopology?.ontapLuns?.length
                            ? resourceDetails?.databaseInstanceTopology?.ontapLuns
                                  ?.map((volume: any) => volume.name)
                                  .join(', ')
                            : t('databases.general.not-available')
                    }
                >
                    {resourceDetails?.databaseInstanceTopology?.ontapLuns &&
                    resourceDetails?.databaseInstanceTopology?.ontapLuns?.length
                        ? resourceDetails?.databaseInstanceTopology?.ontapLuns
                              ?.map((volume: any) => volume.name)
                              .join(', ')
                        : t('databases.general.not-available')}
                </DsTypography>
            </div>
        </>
    );
    return (
        <div className="">
            <DbAccordion
                heading="Storage & Compute"
                toggle={handleToggle}
                open={openKey === 'Storage & Compute'}
                content={contentArea()}
            />
        </div>
    );
};

export default StorageCompute;
