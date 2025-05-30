import { DsTypography, Header } from '@netapp/design-system';

import styles from './CreateNewDBHeader.module.scss';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../../store/storeHooks';
import { GENERAL } from '../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { updateRefreshBlocked } from '../../../store/authSlice';
import { FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY, FORM_TO_WLF_NAVIGATE_INVENTORY } from '../../../utils/consts';
const CreateNewUserHeader = () => {
    const navigate = useNavigate();
    const dbHostName = useAppSelector(state => state.createNewUser.dbHostName);
    const dispatch = useDispatch();
    const state = useAppSelector(state => state);
    const isWorkloadFactoryStatus = state.auth?.isWorkloadFactory;

    const closeHandler = () => {
        dispatch(updateRefreshBlocked(true));
        if (isWorkloadFactoryStatus) {
            navigate(FORM_TO_WLF_NAVIGATE_INVENTORY);
        } else {
            navigate(FORM_TO_WLF_NAVIGATE_BLUEXP_INVENTORY);
        }
    };

    return (
        <div className={styles.createNewUserHeader}>
            <Header
                closeButtonProps={{
                    onClick: () => {
                        dispatch(updateRefreshBlocked(true));
                        closeHandler();
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
