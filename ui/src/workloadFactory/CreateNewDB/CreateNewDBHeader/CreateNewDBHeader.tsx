import { DsTypography, Header } from '@netapp/design-system';

import styles from './CreateNewDBHeader.module.scss';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
const CreateNewUserHeader = () => {
    const navigate = useNavigate();
    const dbHostName = useAppSelector(state => state.createNewUser.dbHostName);

    return (
        <div className={styles.createNewUserHeader}>
            <Header
                closeButtonProps={{
                    onClick: () => {
                        navigate('../databases');
                    }
                }}
                title={
                    <div className={styles.leftSideStyle}>
                        <div>{GENERAL.CREATE_USER_DB_TITLE}</div>
                        <div className={styles.separator} />
                        <DsTypography variant="Semibold_14" className={styles.hostName}>
                            {GENERAL.DB_CREATE_HOST} {dbHostName}
                        </DsTypography>
                    </div>
                }
                style={{ width: '100vw' }}
            ></Header>
        </div>
    );
};

export default CreateNewUserHeader;
