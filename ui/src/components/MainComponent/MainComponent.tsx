import { StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import MSSqlFooter from '../MSSqlServer/MSSqlFooter/MSSqlFooter';

import MSSqlHeader from '../MSSqlServer/MSSqlHeader/MSSqlHeader';
import MSSqlServer from '../MSSqlServer/MSSqlServer';
import styles from './MainComponent.module.scss';

const MainComponent = () => {
    return (
        <StepLayout className={styles.header}>
            <MSSqlHeader />
            <WizardContent className={styles.content}>
                <MSSqlServer />
            </WizardContent>
            <WizardFooter>
                <MSSqlFooter />
            </WizardFooter>
        </StepLayout>
    );
};

export default MainComponent;
