import { Typography, Popover } from '@netapp/design-system';
import styles from './InformationPane.module.scss';
//@ts-ignore
import CopyToClipboard from 'react-copy-to-clipboard';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { GENERAL } from '../../../../utils/appConstants';

type InformationDataType = {
    label: string;
    value: string;
    showCopy: boolean;
};

type InformationPaneProps = {
    mssqlSummary: {
        serverId: string;
        serverVersion: string;
        serverStatus: string;
        serverEdition: string;
        serverEngine: string;
        activeConnections: string;
        deploymentModel: string;
        primaryNode: string;
        standbyNode: string;
        activeNode: string;
    }
}

const InformationPane = ({mssqlSummary}: InformationPaneProps) => {
    const informationData = mssqlSummary ? [
        { label: 'Deployment model', value: mssqlSummary.deploymentModel, showCopy: true },
        { label: 'SQL Server edition', value: mssqlSummary.serverEdition, showCopy: true },
        { label: 'SQL Server version', value: mssqlSummary.serverVersion, showCopy: true },
        { label: 'Status', value: mssqlSummary.serverStatus, showCopy: true },
        { label: 'Cluster name', value: 'sqldatabase-cluster', showCopy: true },
        { label: `Node 1 name ${(mssqlSummary.activeNode === mssqlSummary.primaryNode ? '(active)' : '')}`, value: mssqlSummary.primaryNode, showCopy: true },
        { label: `Node 2 name ${(mssqlSummary.activeNode === mssqlSummary.standbyNode ? '(active)' : '')}`, value: mssqlSummary.standbyNode, showCopy: true },
        { label: 'ID', value: mssqlSummary.serverId, showCopy: true },
        { label: 'Connections', value: mssqlSummary.activeConnections, showCopy: false }
    ] : [];

    return (
        <div className={styles.informationPane}>
            <div className={styles.informationTitle}>
                <Typography className={styles.informationTitleText} variant="Semibold_14">
                    {GENERAL.INFORMATION}
                </Typography>
            </div>
            <div className={styles.titleTag}>
                <Typography variant="Semibold_14">Microsoft SQL Server | ONTAP</Typography>
            </div>
            <div className={styles.informationContainer}>
                {informationData.map((item: InformationDataType) => {
                    return (
                        <div className={styles.infoItemContainer}>
                            <Typography variant="Semibold_14">{`${item.label}: `}</Typography>
                            <Typography variant="Regular_14">{item.value}</Typography>
                            {item.showCopy && (
                                <div className={styles.copyContainer}>
                                    <Popover
                                        popoverClass={styles['copy-popover']}
                                        children={'Copied to clipboard'}
                                        container={
                                            <CopyToClipboard text={item.value}>
                                                <CopyIcon fill={'#c8c8c8'}></CopyIcon>
                                            </CopyToClipboard>
                                        }
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InformationPane;
