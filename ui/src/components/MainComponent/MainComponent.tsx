import { StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import MSSqlFooter from '../MSSqlServer/MSSqlFooter/MSSqlFooter';

import MSSqlHeader from '../MSSqlServer/MSSqlHeader/MSSqlHeader';
import MSSqlServer from '../MSSqlServer/MSSqlServer';
import styles from './MainComponent.module.scss';
import { Spinner } from '@netapp/design-system';
import { useAppSelector } from '../../store/storeHooks';

const MainComponent = () => {

    const loading = useAppSelector(state => state.msSqlAction.isLoading);

    return (
        <StepLayout className={`${styles.header}`}> 
            <MSSqlHeader />
            <WizardContent className={styles.content}>
                <MSSqlServer />
            </WizardContent>
            <WizardFooter>
                <MSSqlFooter />
            </WizardFooter>
            {loading && (<div className={styles.loaderoverlay}><Spinner isLarge/></div>)}
        </StepLayout>
    );
};

export default MainComponent;
