import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';
import styles from './SQLServer.module.scss';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { formatDateWithTime } from '../../../../utils/utilityFunctions';
import { GENERAL } from '../../../../utils/appConstants';

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
                        {GENERAL.DEPLOYMENT_MODEL_INFO}
                    </Typography>
                    <Typography variant="Regular_14">Always On Failover</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.OS_INFO}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.operatingSystem}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.EDITION_INFO}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.serverEdition}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.VERSION_INFO}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.serverVersion}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.CLUSTER_NAME_INFO}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.clusterName}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.NODE_NAMES}
                    </Typography>
                    <Typography variant="Regular_14">sqlnode1, sqlnode2</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.STATUS_INFO}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.status}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.CONNECTIONS_INFO}
                    </Typography>
                    <Typography variant="Regular_14">{resourceDetails.activeConnections}</Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.DATE_CREATED}
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
