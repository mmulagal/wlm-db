import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';

import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';

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
                    <Typography variant="Regular_14">
                        {resourceDetails?.topology?.ec2Details[0].instanceType}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_NAME}
                    </Typography>
                    <Typography variant="Regular_14">wlmdb-fsx-1</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_ID}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails?.topology?.fsxFilesystemId}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_TYPE}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails?.topology?.fileSystemType}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_STATUS}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails?.topology?.fileSystemStatus}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.STORAGE_CAPACITY_INFO}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails?.topology?.fileSystemStorageCapacity}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FILE_SYS_DP_TYPE}
                    </Typography>
                    <Typography variant="Regular_14">Multi-AZ</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.FSX_THROUGHPUT_TYPE}
                    </Typography>
                    <Typography variant="Regular_14">
                        {resourceDetails?.topology?.fileSystemThroughputCapacity}
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
