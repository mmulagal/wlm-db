import React from 'react';
import styles from './SandboxHeader.module.scss';
import { ReactComponent as Illustration } from '../../../assets/Illustration.svg';
import { Button, DsTypography } from '@netapp/design-system';
import useResize from '../../../common/hooks/useResize';
import { useNavigate } from 'react-router-dom';

import { useDispatch } from 'react-redux';
import { GENERAL } from '../../../utils/appConstants';

const SandboxHeader = () => {
    const windowSize = useResize();
    const navigate = useNavigate();

    const handleBanner = () => {
        localStorage.setItem('showBanner', JSON.stringify(true));
    };
    return (
        <>
            {windowSize.width > 1500 && (
                <div className={styles.sandboxHeader}>
                    <div className={styles.imageHolder}>
                        <Illustration />
                    </div>
                    <div className={styles.contentHolder}>
                        <DsTypography variant="Semibold_16">{GENERAL.SANDBOXES}</DsTypography>
                        <DsTypography variant="Regular_16" style={{ marginTop: '5px' }}>
                            {GENERAL.SANDBOX_HEADER_CONTENT}
                        </DsTypography>
                    </div>
                    <div className={styles.buttonHolder}>
                        <Button variant="primary" onClick={() => navigate('../create-new-sandbox')}>
                            {GENERAL.CREATE_NEW_SANDBOX}
                        </Button>
                        <Button variant="text" onClick={() => handleBanner()}>
                            {GENERAL.DONT_SHOW_AGAIN}
                        </Button>
                    </div>
                </div>
            )}
            {windowSize.width <= 1500 && (
                <div className={styles.sandboxHeaderLowerResolution}>
                    <div className={styles.imageHolder}>
                        {' '}
                        <Illustration />
                    </div>
                    <div className={styles.secondLevel}>
                        <div className={styles.contentHolder}>
                            <DsTypography variant="Semibold_16">{GENERAL.SANDBOXES}</DsTypography>
                            <DsTypography variant="Regular_14" style={{ marginTop: '5px' }}>
                                {GENERAL.SANDBOX_HEADER_CONTENT}
                            </DsTypography>
                        </div>
                        <div className={styles.buttonHolder}>
                            <Button
                                variant="primary"
                                style={{ height: '32px' }}
                                onClick={() => navigate('../create-new-sandbox')}
                            >
                                {GENERAL.CREATE_NEW_SANDBOX}
                            </Button>
                            <Button variant="text" isThin onClick={() => handleBanner()}>
                                {GENERAL.DONT_SHOW_AGAIN}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SandboxHeader;
