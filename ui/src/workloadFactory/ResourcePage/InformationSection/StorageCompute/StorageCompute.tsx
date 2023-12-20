import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as Success } from '../../../../assets/success.svg';
import { ReactComponent as Failure } from '../../../../assets/error-icon.svg';
import styles from './StorageCompute.module.scss';

type accordionType = {
    handleToggle: any;
    openKey: string;
};

const StorageCompute = ({ handleToggle, openKey }: accordionType) => {
    const resourceDetails = useAppSelector(state => state.workloadFactoryResource.resourceDetails);
    const contentArea = () => {
        return (
            <>
                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.DB_INSTANCE_TYPE}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.topology?.ec2Details[0].instanceType || ''}
                    >
                        {resourceDetails?.topology?.ec2Details[0].instanceType}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_NAME}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.topology?.fileSystemName || ''}
                    >
                        {resourceDetails?.topology?.fileSystemName}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_ID}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.topology?.fileSystemId || ''}
                    >
                        {resourceDetails?.topology?.fileSystemId}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_TYPE}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.topology?.fileSystemType || ''}
                    >
                        {resourceDetails?.topology?.fileSystemType}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_STATUS}
                    </Typography>
                    <div className={styles.statusIconClass}>
                        {resourceDetails?.topology?.fileSystemStatus &&
                        resourceDetails?.topology?.fileSystemStatus.toLowerCase() === 'available' ? (
                            <Success />
                        ) : (
                            <Failure />
                        )}
                        <Typography
                            variant="Regular_14"
                            className={commonStyles.valueCSS}
                            title={resourceDetails?.topology?.fileSystemStatus || ''}
                        >
                            {resourceDetails?.topology?.fileSystemStatus}
                        </Typography>
                    </div>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.STORAGE_CAPACITY_INFO}
                    </Typography>
                    <Typography variant="Regular_14">
                        {resourceDetails?.topology?.fileSystemStorageCapacity
                            ? `${resourceDetails.topology.fileSystemStorageCapacity} GiB`
                            : ''}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_DP_TYPE}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails?.topology?.fileSystemDeploymentMode}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FSX_THROUGHPUT_TYPE}
                    </Typography>
                    <Typography variant="Regular_14">
                        {resourceDetails?.topology?.fileSystemThroughputCapacity
                            ? `${resourceDetails.topology.fileSystemThroughputCapacity} MB/s`
                            : ''}
                    </Typography>
                </div>
            </>
        );
    };
    return (
        <div className={''}>
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
