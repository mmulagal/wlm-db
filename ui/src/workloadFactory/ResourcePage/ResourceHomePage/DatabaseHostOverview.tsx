import { useNavigate } from 'react-router-dom';
import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import { useAppSelector } from '../../../store/storeHooks';
import DatabaseListTable from '../DatabaseListTable/DatabaseListTable';
import DatabaseOverviewLayout from '../DatabaseOverviewLayout/DatabaseOverviewLayout';
import OverviewTabs from '../OverviewTabs/OverviewTabs';

import styles from './DatabaseHostOverview.module.scss';

const DatabaseHostOverview = () => {
    const selectedTab = useAppSelector(state => state.databaseHome.selectedTab);
    const navigate = useNavigate();
    return (
        <div className={styles.resourcePage}>
            <div className={styles.breadCrumb}>
                <BreadCrumbs
                    items={[
                        {
                            title: 'Databases',
                            onClick: () => {
                                navigate('databases');
                            }
                        },
                        {
                            title: 'Database host name'
                        }
                    ]}
                />
            </div>

            <div className={styles.secondLevel}>
                <OverviewTabs />
                {selectedTab === 'Overview' && <DatabaseOverviewLayout />}
                {selectedTab === 'Database list' && <DatabaseListTable />}
            </div>
        </div>
    );
};

export default DatabaseHostOverview;
