import { StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import styles from './PostgressMainComponent.module.scss';
import PostgressHeader from './PostgressHeader/PostgressHeader';
import PostgressFooter from './PostgressFooter/PostgressFooter';
import PostgressLayout from './PostgressLayout/PostgressLayout';
import MssqlApis from '../CreateMsSql/MSSqlServer/MssqlApis';
import PostgreCodebox from './PostgreCodebox/PostgreCodebox';

const PostgressMainComponent = () => {
    MssqlApis();
    return (
        <div className={styles.protectComponent}>
            <div className={styles.leftSide}>
                <StepLayout className={styles.header}>
                    <PostgressHeader />
                    <WizardContent className={styles.content}>
                        <PostgressLayout />
                    </WizardContent>
                    <WizardFooter>
                        <PostgressFooter />
                    </WizardFooter>
                </StepLayout>
            </div>

            <div className={styles.rightSide}>
                <PostgreCodebox />
            </div>
        </div>
    );
};

export default PostgressMainComponent;
