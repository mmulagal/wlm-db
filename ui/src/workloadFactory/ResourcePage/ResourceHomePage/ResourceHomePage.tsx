import BreadCrumbs from '../../../common/BreadCrumbs/BreadCrumbs';
import CPU from './CPU/CPU';
import DiskUtilization from './Disk Utilization/DiskUtilization';
import HeaderContainer from './HeaderContainer/HeaderContainer';
import Memory from './Memory/Memory';
import styles from './ResourceHomePage.module.scss';
import Topology from './Topology/Topology';
import Transactions from './Transactions/Transactions';

const ResourceHomePage = () => {
    return (
        <div className={styles.resourcePage}>
            <div className={styles.breadCrumb}>
                <BreadCrumbs
                    items={[
                        {
                            title: 'Databases dashboard',
                            onClick: () => {}
                        },
                        {
                            title: 'Database Information'
                        }
                    ]}
                />
            </div>
            <HeaderContainer />

            <div className={styles.secondLevel}>
                <Memory />
                <CPU />
                <Transactions />
                <DiskUtilization />
            </div>

            <div className={styles.thirdLevel}>
                <Topology />
            </div>
        </div>
    );
};

export default ResourceHomePage;
