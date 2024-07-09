import { Header } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import styles from './CreateNewSandboxHeader.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { updateRefreshBlocked } from '../../../../store/authSlice';

function CreateNewSandboxHeader() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    return (
        <div className={styles.sandboxHeader}>
            <Header
                closeButtonProps={{
                    onClick: () => {
                        dispatch(updateRefreshBlocked(true));
                        navigate('../databases');
                    }
                }}
                title={<div className={styles.leftSideStyle}>{GENERAL.CREATE_NEW_SANDBOX}</div>}
                style={{ width: '100vw' }}
            ></Header>
        </div>
    );
}

export default CreateNewSandboxHeader;
