import { Header } from '@netapp/design-system';

import styles from './CreateNewUserHeader.module.scss';
const CreateNewUserHeader = () => {
    return (
        <div className={styles.createNewUserHeader}>
            <Header
                closeButtonProps={{
                    onClick: () => {}
                }}
                title={'Create new user database'}
                style={{ width: '100vw' }}
            />
        </div>
    );
};

export default CreateNewUserHeader;
