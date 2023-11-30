import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import DatabaseOverviewLayout from '../DatabaseOverviewLayout/DatabaseOverviewLayout';

import styles from './DatabaseHostOverview.module.scss';

const DatabaseHostOverview = () => {
    return (
        <div className={styles.resourcePage}>
            <div className={styles.breadCrumb}>
                <BreadCrumbs
                    items={[
                        {
                            title: 'Databases',
                            onClick: () => {}
                        },
                        {
                            title: 'Database host name'
                        }
                    ]}
                />
            </div>

            <div className={styles.secondLevel}>
                <DatabaseOverviewLayout />
            </div>
        </div>
    );
};

export default DatabaseHostOverview;
