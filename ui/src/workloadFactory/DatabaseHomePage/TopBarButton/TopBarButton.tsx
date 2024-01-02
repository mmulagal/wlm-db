import React from 'react';
import { Button } from '@netapp/design-system';

import { useNavigate } from 'react-router-dom';
import { WLF_TO_FORM_NAVIGATE } from '../../../utils/consts';
import { ReactComponent as SpaceShip } from '../../../assets/ic_spaceship.svg';
import { ReactComponent as Monitoring } from '../../../assets/ic_monitoring.svg';

import styles from './TopBarButtons.module.scss';
import { GENERAL } from '../../../utils/appConstants';
import { useAppDispatch } from '../../../store/storeHooks';
import { databaseHomeApi } from '../../../utils/apiService';
import { addInitialData, initialDBHomepageState } from '../../../store/workloadFactory/databaseHomeSlice';
import { ReactComponent as RefreshIcon } from '@netapp/icons/ic_refresh.svg';

const TopBarButton = () => {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    // const refreshPage = () => {
    //     dispatch(databaseHomeApi.util.resetApiState());
    //     dispatch(addInitialData(initialDBHomepageState));
    // }

    return (
        <div className={styles.topBarButtons}>
            {/* <div className={styles.refreshIcon} onClick={() => {refreshPage()}}>
                <RefreshIcon />                      
            </div> */}
            <div className={styles.firstRow}>
                <div className={styles.firstButton}>
                    <Monitoring />
                    <Button
                        variant="text"
                        onClick={() => {
                            navigate('../job-monitor');
                        }}
                    >
                        Job monitoring
                    </Button>
                </div>

                <div className={styles.firstButton}>
                    <Monitoring />
                    <Button
                        variant="text"
                        isDisabled
                        title="Coming soon"
                        onClick={() => {
                            navigate('../job-monitor');
                        }}
                    >
                        Policy management
                    </Button>
                </div>
            </div>
            <Button
                variant="primary"
                onClick={() => {
                    navigate(WLF_TO_FORM_NAVIGATE);
                }}
            >
                <div className={styles.buttonStyle}>
                    <SpaceShip />
                    {GENERAL.DEPLOY_NEW_DATABASE}
                </div>
            </Button>
        </div>
    );
};

export default TopBarButton;
