import InfoCard from './InfoCard/InfoCard';
import InformationPane from './InformationPane/InformationPane';
import styles from './MsSqlOverview.module.scss';
import ResourceDistribution from './ResourceDistribution/ResourceDistribution';
import { ReactComponent as DatabasesIcon } from '../../../assets/databases-icon.svg';
import { ReactComponent as TablesIcon } from '../../../assets/tables-icon.svg';
import { useNavigate, useOutletContext } from 'react-router';

const MsSqlOverview = () => {
    const navigate = useNavigate();
    let {databasesList, mssqlSummary, mssqlCpu, mssqlDisk, mssqlMemory, tables, batchingCompleted} = 
    useOutletContext<{databasesList: any, mssqlSummary: any, mssqlCpu: any, mssqlDisk: any, mssqlMemory: any, tables: any, 
        batchingCompleted: boolean}>();

    return (
        <div className={styles.overviewContainer}>
            <div className={styles.leftPane}>
                <div className={styles.resourceDistribution}>
                    <ResourceDistribution mssqlCpu={mssqlCpu} mssqlDisk={mssqlDisk} mssqlMemory={mssqlMemory}/>
                </div>
                <div className={styles.infoCards}>
                    <InfoCard
                        renderIcon={() => {
                            return <DatabasesIcon />;
                        }}
                        value={databasesList.length}
                        label={'Databases'}
                        buttonText={'View Databases'}
                        buttonClick={function (): void {
                            navigate('../databases');
                        }}
                    />
                    <InfoCard
                        renderIcon={() => {
                            return <TablesIcon />;
                        }}
                        value={tables.length}
                        label={'Tables'}
                        buttonText={'View Tables'}
                        buttonClick={function (): void {
                            navigate('../tables');
                        }}
                    />
                </div>
            </div>
            <div className={styles.rightPane}>
                <InformationPane mssqlSummary={mssqlSummary}/>
            </div>
        </div>
    );
};

export default MsSqlOverview;
