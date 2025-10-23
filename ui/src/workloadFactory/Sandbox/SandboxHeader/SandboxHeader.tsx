import React from 'react';
import { Button, DsTypography } from '@netapp/design-system';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import styles from './SandboxHeader.module.scss';
import { ReactComponent as Illustration } from '../../../assets/Illustration.svg';
import useResize from '../../../common/hooks/useResize';

import { GENERAL } from '../../../utils/appConstants';
import { setShowBanner } from '../../../store/workloadFactory/sandboxSlice';
import { setSelectedSandboxHeaderValue } from '../../../store/workloadFactory/createSandboxSlice';
import { useAppSelector } from '../../../store/storeHooks';
import { createSandboxNavigation } from '../../../utils/utilityFunctions';

const SandboxHeader = () => {
    const windowSize = useResize();
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const { headerSelectedCredSandbox, headerSelectedRegionSandbox } = useAppSelector(state => state.headers);

    const handleBanner = () => {
        localStorage.setItem('hideBanner', JSON.stringify(true));
        dispatch(setShowBanner(false));
    };
    return (
        <>
            {windowSize.width > 1658 && (
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
                        <Button
                            variant="primary"
                            onClick={() => {
                                dispatch(
                                    setSelectedSandboxHeaderValue({
                                        credId: headerSelectedCredSandbox?.data?.credentialsId,
                                        regionId: headerSelectedRegionSandbox?.label2
                                    })
                                );
                                createSandboxNavigation(navigate);
                            }}
                        >
                            {GENERAL.CREATE_SANDBOX}
                        </Button>
                        <Button variant="text" onClick={() => handleBanner()}>
                            {GENERAL.DONT_SHOW_AGAIN}
                        </Button>
                    </div>
                </div>
            )}

            {windowSize.width > 1429 && windowSize.width < 1658 && (
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
                                onClick={() => {
                                    dispatch(
                                        setSelectedSandboxHeaderValue({
                                            credId: headerSelectedCredSandbox?.data?.credentialsId,
                                            regionId: headerSelectedRegionSandbox?.label2
                                        })
                                    );
                                    createSandboxNavigation(navigate);
                                }}
                            >
                                {GENERAL.CREATE_SANDBOX}
                            </Button>
                            <Button variant="text" isThin onClick={() => handleBanner()}>
                                {GENERAL.DONT_SHOW_AGAIN}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {windowSize.width <= 1428 && (
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
                                onClick={() => {
                                    dispatch(
                                        setSelectedSandboxHeaderValue({
                                            credId: headerSelectedCredSandbox?.data?.credentialsId,
                                            regionId: headerSelectedRegionSandbox?.label2
                                        })
                                    );
                                    createSandboxNavigation(navigate);
                                }}
                            >
                                {GENERAL.CREATE_SANDBOX}
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
