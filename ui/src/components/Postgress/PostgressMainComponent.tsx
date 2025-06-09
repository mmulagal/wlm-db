import { Spinner, StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import styles from './PostgressMainComponent.module.scss';
import PostgressHeader from './PostgressHeader/PostgressHeader';
import PostgressFooter from './PostgressFooter/PostgressFooter';
import PostgressLayout from './PostgressLayout/PostgressLayout';
import { useAppSelector } from '../../store/storeHooks';
import PostgreCodebox from './PostgreCodebox/PostgreCodebox';
import PostgreApis from './PostgreServer/PostgreApis';

const PostgressMainComponent = () => {
    const loading = useAppSelector(state => state.msSqlAction.isLoading);
    PostgreApis();
    return (
        <div className={styles.protectComponent}>
            {loading && (
                <>
                    <div className={styles.loaderOverlay} />
                    <div className={styles.spinnerPlacement}>
                        <Spinner isLarge />
                    </div>
                </>
            )}
            <div>
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
        </div>
    );
};

export default PostgressMainComponent;
