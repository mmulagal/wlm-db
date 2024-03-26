import React from 'react';
import styles from './SandboxHeader.module.scss';
import { ReactComponent as Illustration } from '../../../assets/Illustration.svg';
import { Button, DsTypography } from '@netapp/design-system';
import useResize from '../../../common/hooks/useResize';

const SandboxHeader = () => {
    const windowSize = useResize();
    return (
        <>
            {window.innerWidth > 1500 && (
                <div className={styles.sandboxHeader}>
                    <div className={styles.imageHolder}>
                        <Illustration />
                    </div>
                    <div className={styles.contentHolder}>
                        <DsTypography variant="Semibold_16">Sandboxes</DsTypography>
                        <DsTypography variant="Regular_16">
                            Sandbox is an on-demand, isolated database environment designed to replicate real-world
                            scenarios without affecting production data. It streamlines the development lifecycle by
                            providing an instantaneous copy of your database for testing, integration, diagnostics and
                            training, thereby accelerating time-to-market while ensuring data integrity and security.
                        </DsTypography>
                    </div>
                    <div className={styles.buttonHolder}>
                        <Button variant="primary">Create new sandbox</Button>
                        <Button variant="text">Don't show again</Button>
                    </div>
                </div>
            )}
            {window.innerWidth <= 1500 && (
                <div className={styles.sandboxHeaderLowerResolution}>
                    <div className={styles.imageHolder}>
                        {' '}
                        <Illustration />
                    </div>
                    <div className={styles.secondLevel}>
                        <div className={styles.contentHolder}>
                            <DsTypography variant="Semibold_16">Sandboxes</DsTypography>
                            <DsTypography variant="Regular_14">
                                Sandbox is an on-demand, isolated database environment designed to replicate real-world
                                scenarios without affecting production data. It streamlines the development lifecycle by
                                providing an instantaneous copy of your database for testing, integration, diagnostics
                                and training, thereby accelerating time-to-market while ensuring data integrity and
                                security.
                            </DsTypography>
                        </div>
                        <div className={styles.buttonHolder}>
                            <Button variant="primary" style={{ height: '32px' }}>
                                Create new sandbox
                            </Button>
                            <Button variant="text" isThin>
                                Don't show again
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default SandboxHeader;
