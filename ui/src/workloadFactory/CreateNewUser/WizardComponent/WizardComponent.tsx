import { StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import styles from './WizardComponent.module.scss';
import CreateNewUserHeader from '../CreateNewUserHeader/CreateNewUserHeader';
import CreateNewUserFooter from '../CreateNewUserFooter/CreateNewUserFooter';
import ContentComponent from '../ContentComponent/ContentComponent';
import CreateNewUserCodeBox from '../CreateNewUserCodeBox/CreateNewUserCodeBox';

const WizardComponent = () => {
    return (
        <div className={styles.wizardComponent}>
            <div className={styles.leftSide}>
                <StepLayout className={styles.header}>
                    <CreateNewUserHeader />
                    <WizardContent className={styles.content}>
                        <ContentComponent />
                    </WizardContent>

                    <WizardFooter>
                        <CreateNewUserFooter />
                    </WizardFooter>
                </StepLayout>
            </div>

            <div className={styles.rightSide}>
                <CreateNewUserCodeBox />
            </div>
        </div>
    );
};

export default WizardComponent;
