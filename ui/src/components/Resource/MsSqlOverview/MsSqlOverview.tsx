import InfoCard from './InfoCard/InfoCard';
import InformationPane from './InformationPane/InformationPane';
import styles from './MsSqlOverview.module.scss';
import ResourceDistribution from './ResourceDistribution/ResourceDistribution';
import { ReactComponent as DatabasesIcon } from '../../../assets/databases-icon.svg';
import { ReactComponent as TablesIcon } from '../../../assets/tables-icon.svg';
import { useNavigate } from 'react-router';

const MsSqlOverview = () => {
    const navigate = useNavigate();
    return (
        <div className={styles.overviewContainer}>
            <div className={styles.leftPane}>
                <div className={styles.resourceDistribution}>
                    <ResourceDistribution />
                </div>
                <div className={styles.infoCards}>
                    <InfoCard
                        renderIcon={() => {
                            return <DatabasesIcon />;
                        }}
                        value={'7'}
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
                        value={'65'}
                        label={'Tables'}
                        buttonText={'View Tables'}
                        buttonClick={function (): void {
                            navigate('../tables');
                        }}
                    />
                </div>
            </div>
            <div className={styles.rightPane}>
                <InformationPane />
            </div>
        </div>
    );
};

export default MsSqlOverview;
