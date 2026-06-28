import React, { useCallback, useEffect, useRef } from 'react';
import { DsTypography } from '@netapp/design-system';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../assets/close-icon.svg';
import { ReactComponent as PlanImage } from '../../assets/Plan_image.svg';
import { ReactComponent as ProvisionImage } from '../../assets/Provision_image.svg';
import { ReactComponent as OperateImage } from '../../assets/Operate_image.svg';
import styles from './WelcomeModal.module.scss';

type WelcomeModalProps = {
    onClose: () => void;
};

const WelcomeModal = ({ onClose }: WelcomeModalProps) => {
    const { t } = useTranslation();
    const dialogRef = useRef<HTMLDivElement>(null);

    const handleOverlayClick = useCallback(
        (event: React.MouseEvent<HTMLDivElement>) => {
            if (event.target === event.currentTarget) {
                onClose();
            }
        },
        [onClose]
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    return (
        <div className={styles.overlay} onClick={handleOverlayClick} role="dialog" aria-modal="true">
            <div className={styles.dialog} ref={dialogRef}>
                <button className={styles.closeButton} onClick={onClose} aria-label="Close">
                    <CloseIcon />
                </button>

                <div className={styles.header}>
                    <DsTypography variant="Semibold_24" className={styles.title}>
                        {t('databases.welcome-modal.title')}
                    </DsTypography>
                    <DsTypography variant="Semibold_14" className={styles.subtitle}>
                        {t('databases.welcome-modal.subtitle')}
                    </DsTypography>
                </div>

                <div className={styles.content}>
                    <div className={styles.column}>
                        <div className={styles.imageWrapper}>
                            <PlanImage />
                        </div>
                        <DsTypography variant="Semibold_20" className={styles.columnTitle}>
                            {t('databases.welcome-modal.plan-title')}
                        </DsTypography>
                        <div className={styles.columnBody}>
                            <DsTypography variant="Regular_14">
                                {t('databases.welcome-modal.plan-description-1')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.welcome-modal.plan-description-2')}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.column}>
                        <div className={styles.imageWrapper}>
                            <ProvisionImage />
                        </div>
                        <DsTypography variant="Semibold_20" className={styles.columnTitle}>
                            {t('databases.welcome-modal.provision-title')}
                        </DsTypography>
                        <div className={styles.columnBody}>
                            <DsTypography variant="Regular_14">
                                {t('databases.welcome-modal.provision-description-1')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.welcome-modal.provision-description-2')}
                            </DsTypography>
                        </div>
                    </div>

                    <div className={styles.column}>
                        <div className={styles.imageWrapper}>
                            <OperateImage />
                        </div>
                        <DsTypography variant="Semibold_20" className={styles.columnTitle}>
                            {t('databases.welcome-modal.operate-title')}
                        </DsTypography>
                        <div className={styles.columnBody}>
                            <DsTypography variant="Regular_14">
                                {t('databases.welcome-modal.operate-description-1')}
                            </DsTypography>
                            <DsTypography variant="Regular_14">
                                {t('databases.welcome-modal.operate-description-2')}
                            </DsTypography>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WelcomeModal;
