import styles from './Sandbox.module.scss';
import SandboxHeader from './SandboxHeader/SandboxHeader';
import SourceInformation from './SourceInformation/SourceInformation';
import SandboxStorageSaving from './SandboxStorageSaving/SandboxStorageSaving';
import SandboxDistributionDate from './SandboxDistributionDate/SandboxDistributionDate';
import SandboxDistributionType from './SandboxDistributionType/SandboxDistributionType';
import SandboxTable from './SandboxTable/SandboxTable';
import { useAppSelector } from '../../store/storeHooks';

const Sandbox = () => {
    const { showBanner } = useAppSelector(state => state?.sandbox);

    return (
        <div className={styles.sandbox}>
            {showBanner && <SandboxHeader />}

            <div className={styles.sandboxSecondLevel}>
                <SourceInformation />
                <SandboxStorageSaving />
            </div>

            <div className={styles.sandboxSecondLevel}>
                <SandboxDistributionDate />
                <SandboxDistributionType />
            </div>

            <SandboxTable />
        </div>
    );
};

export default Sandbox;
