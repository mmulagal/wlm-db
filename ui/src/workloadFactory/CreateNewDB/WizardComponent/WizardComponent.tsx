import { StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import styles from './WizardComponent.module.scss';
import CreateNewUserHeader from '../CreateNewDBHeader/CreateNewDBHeader';
import CreateNewUserFooter from '../CreateNewDBFooter/CreateNewDBFooter';
import ContentComponent from '../ContentComponent/ContentComponent';
import CreateNewUserCodeBox from '../CreateNewDBCodeBox/CreateNewUserCodeBox';

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
