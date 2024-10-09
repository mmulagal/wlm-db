import { Spinner, StepLayout, WizardContent, WizardFooter } from '@netapp/design-system';

import styles from './PostgressMainComponent.module.scss';
import PostgressHeader from './PostgressHeader/PostgressHeader';
import PostgressFooter from './PostgressFooter/PostgressFooter';
import PostgressLayout from './PostgressLayout/PostgressLayout';
import MssqlApis from '../CreateMsSql/MSSqlServer/MssqlApis';
import { useAppSelector } from '../../store/storeHooks';

const PostgressMainComponent = () => {
    const loading = useAppSelector(state => state.msSqlAction.isLoading);
    MssqlApis();
    return (
        <div className={styles.protectComponent}>
            {loading && (
                <>
                    <div className={styles.loaderOverlay}></div>
                    <div className={styles.spinnerPlacement}>
                        <Spinner isLarge />
                    </div>
                </>
            )}
            <div>
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
        </div>
    );
};

export default PostgressMainComponent;
