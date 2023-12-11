import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';
import styles from './SQLServer.module.scss';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { formatDateWithTime } from '../../../../utils/utilityFunctions';

type sqlServer = {
    handleToggle: any;
    openKey: string;
};

const SQLServer = ({ handleToggle, openKey }: sqlServer) => {
    const { resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    const contentArea = () => {
        return (
            <>
                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Deployment model:
                    </Typography>
                    <Typography variant="Regular_14">Always On Failover</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Operating system:
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.operatingSystem}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Edition:
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.serverEdition}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Version:
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.serverVersion}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Cluster name:
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.clusterName}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Node names:
                    </Typography>
                    <Typography variant="Regular_14">sqlnode1, sqlnode2</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Status:
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.status}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Connections:
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.activeConnections}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        Date Created:
                    </Typography>
                    <Typography variant="Regular_14">{formatDateWithTime(resourceDetails.creationDate)}</Typography>
                </div>
            </>
        );
    };
    return (
        <div className={styles.sqlServer}>
            <DbAccordion
                heading="SQL server"
                toggle={handleToggle}
                open={openKey === 'SQL server'}
                content={contentArea()}
            />
        </div>
    );
};

export default SQLServer;
