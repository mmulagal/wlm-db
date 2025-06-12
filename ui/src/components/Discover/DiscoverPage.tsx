import { StepLayout, WizardContent, WizardFooter, Spinner } from '@netapp/design-system';

import DiscoveryFooter from './DiscoverPageComponents/DiscoveryFooter/DiscoveryFooter';
import DiscoveryHeader from './DiscoverPageComponents/DiscoveryHeader/DiscoveryHeader';
import DiscoveryForm from './DiscoverPageComponents/DiscoveryForm/DiscoveryForm';
import styles from './DiscoverPage.module.scss';
import { useAppSelector } from '../../store/storeHooks';

const DiscoverPage = () => {
    const loading = useAppSelector(state => state.msSqlAction.isLoading);

    return (
        <StepLayout className={styles.header}>
            <DiscoveryHeader />
            <WizardContent className={styles.content}>
                <DiscoveryForm />
            </WizardContent>
            <WizardFooter>
                <DiscoveryFooter />
            </WizardFooter>
            {loading && (
                <div className={styles.loaderoverlay}>
                    <Spinner isLarge />
                </div>
            )}
        </StepLayout>
    );
};

export default DiscoverPage;
