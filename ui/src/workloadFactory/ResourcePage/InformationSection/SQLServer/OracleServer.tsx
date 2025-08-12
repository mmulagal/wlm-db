import { Typography } from '@netapp/design-system';
import moment from 'moment';
import DbAccordion from '../../DatabaseOverviewLayout/DBAccordion/DBAccordion';
import styles from './SQLServer.module.scss';
import commonStyles from '../../../../utils/CommonStyles.module.scss';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useTranslation } from 'react-i18next';

type oracleServer = {
    handleToggle: any;
    openKey: string;
};

const OracleServer = ({ handleToggle, openKey }: oracleServer) => {
    const { t } = useTranslation();
    const { resourceDetails } = useAppSelector(state => state.workloadFactoryResource);
    const contentArea = () => (
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
                <Typography variant="Regular_14" className={commonStyles.valueCSS} title={resourceDetails.status || ''}>
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
    return (
        <div className={styles.sqlServer}>
            <DbAccordion
                heading={'Oracle server'}
                toggle={handleToggle}
                open={openKey === 'Oracle server'}
                content={contentArea()}
            />
        </div>
    );
};

export default OracleServer;
