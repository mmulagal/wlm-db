import React from 'react';
import { Typography, Button } from '@netapp/design-system';
import styles from './HeaderContainer.module.scss';

const HeaderContainer = () => {
    return (
        <div className={styles.headerContainer}>
            <Typography variant="Regular_20" className={styles.heading}>
                Database 1
            </Typography>
            <div className={styles.rightSide}>
                <Button variant="secondary" onClick={() => {}} isThin>
                    Migrate
                </Button>

                <Button variant="secondary" onClick={() => {}} isThin>
                    Clone
                </Button>

                <Button variant="secondary" onClick={() => {}} isThin>
                    Protect
                </Button>
            </div>
        </div>
    );
};

export default HeaderContainer;
