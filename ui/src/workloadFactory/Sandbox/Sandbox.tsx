import styles from './Sandbox.module.scss';
import SandboxHeader from './SandboxHeader/SandboxHeader';
import SourceInformation from './SourceInformation/SourceInformation';
import SandboxStorageSaving from './SandboxStorageSaving/SandboxStorageSaving';
import SandboxDistributionDate from './SandboxDistributionDate/SandboxDistributionDate';
import SandboxDistributionType from './SandboxDistributionType/SandboxDistributionType';
import SandboxTable from './SandboxTable/SandboxTable';
import { useAppSelector } from '../../store/storeHooks';
import { Spinner } from '@netapp/design-system';

const Sandbox = () => {
    const { showBanner, connectionInfoLoading, splitEstimateLoading } = useAppSelector(state => state?.sandbox);

    return (
        <div className={styles.sandbox}>
            {(connectionInfoLoading || splitEstimateLoading) && (
                <>
                    <div className={styles.loaderOverlay}></div>
                    <div className={styles.spinnerPlacement}>
                        <Spinner isLarge />
                    </div>
                </>
            )}
            {showBanner && <SandboxHeader />}

            <div className={styles.sandboxSecondLevel}>
                <SourceInformation />
                <SandboxStorageSaving />
            </div>

            <div className={styles.sandboxSecondLevel} style={{ marginTop: '24px' }}>
                <SandboxDistributionDate />
                <SandboxDistributionType />
            </div>

            <SandboxTable />
        </div>
    );
};

export default Sandbox;
