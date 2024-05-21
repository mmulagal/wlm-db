import { Typography } from '@netapp/design-system';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';
import styles from './SQLServer.module.scss';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import moment from 'moment';

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
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={
                            resourceDetails?.topology?.serverInstallationMode === 'Standalone'
                                ? 'Standalone Instance'
                                : 'Always On Failover Cluster Instance'
                        }
                    >
                        {resourceDetails?.topology?.serverInstallationMode === 'Standalone'
                            ? 'Standalone Instance'
                            : 'Always On Failover Cluster Instance'}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.OS_INFO}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.databaseServer?.operatingSystem || ''}
                    >
                        {resourceDetails?.databaseServer?.operatingSystem}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.EDITION_INFO}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.databaseServer?.serverEdition || ''}
                    >
                        {resourceDetails?.databaseServer?.serverEdition}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.VERSION_INFO}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.databaseServer?.serverVersion || ''}
                    >
                        {resourceDetails?.databaseServer?.serverVersion}
                    </Typography>
                </div>

                {resourceDetails?.databaseServer?.collation && (
                    <div className={commonStyles.row}>
                        <Typography variant="Semibold_14" className={commonStyles.heading}>
                            {GENERAL.CLUSTER_COLLATION_NAME}
                        </Typography>
                        <Typography
                            variant="Regular_14"
                            className={commonStyles.valueCSS}
                            title={resourceDetails?.databaseServer?.collation || ''}
                        >
                            {resourceDetails?.databaseServer?.collation}
                        </Typography>
                    </div>
                )}

                {resourceDetails?.databaseServer?.clusterName && (
                    <div className={commonStyles.row}>
                        <Typography variant="Semibold_14" className={commonStyles.heading}>
                            {GENERAL.CLUSTER_NAME_INFO}
                        </Typography>
                        <Typography
                            variant="Regular_14"
                            className={commonStyles.valueCSS}
                            title={resourceDetails?.databaseServer?.clusterName || ''}
                        >
                            {resourceDetails?.databaseServer?.clusterName}
                        </Typography>
                    </div>
                )}

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.NODE_NAMES}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.databaseServer?.nodeNames.join(', ') || ''}
                    >
                        {resourceDetails?.databaseServer?.nodeNames.join(', ')}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.ACTIVE_NODE}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails?.databaseServer?.activeNode || ''}
                    >
                        {resourceDetails?.databaseServer?.activeNode || ''}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.STATUS_INFO}
                    </Typography>
                    <Typography
                        variant="Regular_14"
                        className={commonStyles.valueCSS}
                        title={resourceDetails.status || ''}
                    >
                        {resourceDetails.status}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.CONNECTIONS_INFO}
                    </Typography>
                    <Typography variant="Regular_14" className={commonStyles.valueCSS}>
                        {resourceDetails?.databaseServer?.activeConnections}
                    </Typography>
                </div>

                <div className={commonStyles.row}>
                    <Typography variant="Semibold_14" className={commonStyles.heading}>
                        {GENERAL.DATE_CREATED}
                    </Typography>
                    <Typography variant="Regular_14" className={commonStyles.valueCSS}>
                        {resourceDetails?.databaseServer?.creationDate
                            ? moment(Number(resourceDetails?.databaseServer?.creationDate)).format(
                                  'MMMM DD, YYYY, HH:mm:ss'
                              )
                            : ''}
                    </Typography>
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
