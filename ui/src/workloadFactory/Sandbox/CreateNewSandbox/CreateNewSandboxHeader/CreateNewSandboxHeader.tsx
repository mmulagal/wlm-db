import { Header } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import styles from './CreateNewSandboxHeader.module.scss';
import { GENERAL } from '../../../../utils/appConstants';
import { useDispatch } from 'react-redux';
import { updateRefreshBlocked } from '../../../../store/authSlice';
import { FORM_TO_WLF_NAVIGATE_BLUEXP_SANDBOXES, FORM_TO_WLF_NAVIGATE_SANDBOXES } from '../../../../utils/consts';
import { useAppSelector } from '../../../../store/storeHooks';
import { setSourceDbHost, setSourceDbInstance } from '../../../../store/workloadFactory/createSandboxSlice';

function CreateNewSandboxHeader() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const state = useAppSelector(state => state);
    const isWorkloadFactoryStatus = state.auth?.isWorkloadFactory;

    const closeHandler = () => {
        dispatch(updateRefreshBlocked(true));
        dispatch(setSourceDbHost(null));
        dispatch(setSourceDbInstance(null));
        if (isWorkloadFactoryStatus) {
            navigate(FORM_TO_WLF_NAVIGATE_SANDBOXES);
        } else {
            navigate(FORM_TO_WLF_NAVIGATE_BLUEXP_SANDBOXES);
        }
    };
    return (
        <div className={styles.sandboxHeader}>
            <Header
                closeButtonProps={{
                    onClick: () => {
                        dispatch(updateRefreshBlocked(true));
                        closeHandler();
                    }
                }}
                title={<div className={styles.leftSideStyle}>{GENERAL.CREATE_NEW_SANDBOX}</div>}
                style={{ width: '100vw' }}
            ></Header>
        </div>
    );
}

export default CreateNewSandboxHeader;
