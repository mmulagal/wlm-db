import React from 'react';
import { Button, Typography } from '@netapp/design-system';

import { useNavigate } from 'react-router-dom';
import { WLF_TO_FORM_NAVIGATE } from '../../../utils/consts';
import { ReactComponent as SpaceShip } from '../../../assets/ic_spaceship.svg';
import { ReactComponent as Search } from '../../../assets/ic_search.svg';
import { ReactComponent as Migrate } from '../../../assets/ic_circle_arrow_right.svg';
import { ReactComponent as Clone } from '../../../assets/ic_copy_replicate_blue.svg';
import { ReactComponent as Protect } from '../../../assets/ic_protected.svg';
import styles from './TopBarButtons.module.scss';
import { GENERAL } from '../../../utils/appConstants';

const TopBarButton = () => {
    const navigate = useNavigate();
    return (
        <div className={styles.topBarButtons}>
            <Button
                variant="secondary"
                onClick={() => {
                    navigate(WLF_TO_FORM_NAVIGATE);
                }}
            >
                <div className={styles.buttonStyle}>
                    <SpaceShip />
                    {GENERAL.DEPLOY_NEW_DATABASE}
                </div>
            </Button>

            <Button variant="secondary" onClick={() => {}}>
                <div className={styles.buttonStyle}>
                    <Search />
                    {GENERAL.DISCOVER}
                </div>
            </Button>

            <Button variant="secondary" onClick={() => {}}>
                <div className={styles.buttonStyle}>
                    <Migrate />
                    {GENERAL.MIGRATE_DB}
                </div>
            </Button>

            <Button variant="secondary" onClick={() => {}}>
                <div className={styles.buttonStyle}>
                    <Clone />
                    {GENERAL.CLONE_DB}
                </div>
            </Button>

            <Button variant="secondary" onClick={() => {}}>
                <div className={styles.buttonStyle}>
                    <Protect />
                    {GENERAL.PROTECT_DB}
                </div>
            </Button>
        </div>
    );
};

export default TopBarButton;
