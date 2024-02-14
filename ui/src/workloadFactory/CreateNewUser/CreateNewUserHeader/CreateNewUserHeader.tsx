import { DsTypography, Header } from '@netapp/design-system';

import styles from './CreateNewUserHeader.module.scss';
import { useNavigate } from 'react-router-dom';
const CreateNewUserHeader = () => {
    const navigate = useNavigate();
    return (
        <div className={styles.createNewUserHeader}>
            <Header
                closeButtonProps={{
                    onClick: () => {
                        navigate('../databases');
                    }
                }}
                title={'Create new user database'}
                style={{ width: '100vw' }}
            >
                <div className={styles.leftSideStyle}>
                    <div className={styles.separator} />
                    <DsTypography variant="Semibold_14" className={styles.hostName}>
                        Host: host name
                    </DsTypography>
                </div>
            </Header>
        </div>
    );
};

export default CreateNewUserHeader;
