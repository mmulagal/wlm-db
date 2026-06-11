import { DsTypography } from '@tlveng/wlm-ds';
import { Popover } from '@netapp/design-system';
import { TFunction } from 'i18next';
import React from 'react';
import styles from './DialogContent.module.scss';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { GENERAL } from '../../../../utils/appConstants';
import { ReactComponent as CopyIcon } from '../../../../assets/ic_copy.svg';
import { ReactComponent as Info } from '../../../../assets/info.svg';
import CopyToClipboardCommon from '../../../../common/CopyToClipboard/copyToClipboard';

// Helper function to create a section with title and description
export const createSection = (title: string, description?: string | React.ReactNode, style?: React.CSSProperties) => (
    <div className={styles['first-section']}>
        <DsTypography variant="Semibold_14" style={style}>
            {title}
        </DsTypography>
        {description &&
            (typeof description === 'string' ? (
                <DsTypography variant="Regular_14" style={style}>
                    {description}
                </DsTypography>
            ) : (
                description
            ))}
    </div>
);

// Helper function to create a bullet point row
export const createBulletRow = (text: string | React.ReactNode, hasBullet: boolean = true) => (
    <div className={styles.row}>
        {hasBullet && (
            <div>
                <Bullet />
            </div>
        )}
        {typeof text === 'string' ? <DsTypography variant="Regular_14">{text}</DsTypography> : text}
    </div>
);

// Helper function to create content with bullet points
export const createContentWithBullets = (items: (string | React.ReactNode)[]) => (
    <div className={styles.content}>
        {items.map(item => (
            <div key={typeof item === 'string' ? item : Math.random().toString()} className={styles.row}>
                <div>
                    <Bullet />
                </div>
                {typeof item === 'string' ? <DsTypography variant="Regular_14">{item}</DsTypography> : item}
            </div>
        ))}
    </div>
);

// Helper function to create a code box
export const createCodeBox = (content: string | string[]) => (
    <div className={styles['dialog-body']}>
        <div className={styles['code-box']}>
            <div className={styles.code}>
                {Array.isArray(content) ? (
                    content.map((line, index) => (
                        <DsTypography key={index} variant="Regular_14" style={{ display: 'block' }}>
                            {line}
                        </DsTypography>
                    ))
                ) : (
                    <DsTypography variant="Regular_14">{content}</DsTypography>
                )}
            </div>
        </div>
    </div>
);

// Helper function to create a command code box with an inline copy button
export const createCodeBoxWithCopy = (command: string, copiedMessage: string) => (
    <div className={styles['command-list-code']}>
        <div className={styles['command-code-box']}>
            <span className={styles['command-text']}>{command}</span>
            <div className={styles['command-copy']}>
                <Popover
                    popoverClass={styles['copy-popover']}
                    container={<CopyToClipboardCommon value={command} iconProvided={<CopyIcon />} />}
                >
                    {copiedMessage}
                </Popover>
            </div>
        </div>
    </div>
);

// Helper function to create standard notes section
export const createStandardNotesSection = (t?: any, isWad: boolean = false) => {
    if (isWad) {
        // For one-time assessment: show only informational note with bullet, no authorization
        return createSection(GENERAL.NOTE, createContentWithBullets([GENERAL.NOTE_PONT_ONE]), { width: '712px' });
    }

    // For managed instances: show all notes including authorization
    return createSection(GENERAL.NOTE, createContentWithBullets([GENERAL.NOTE_PONT_ONE, GENERAL.NOTE_PONT_TWO]), {
        width: '712px'
    });
};

// Helper function to create OS notes section
export const createOSNotesSection = (isWad: boolean = false) =>
    createSection(
        GENERAL.NOTE,
        createContentWithBullets(
            isWad ? [GENERAL.OS_NOTE_POINT_ONE] : [GENERAL.OS_NOTE_POINT_ONE, GENERAL.OS_NOTE_POINT_TWO]
        ),
        { width: '712px' }
    );

// Helper function to create failover cluster notes section
export const createFailoverClusterNotesSection = (t: any, isWad: boolean = false) => {
    if (isWad) {
        // For one-time assessment: only informational note with bullet, no authorization
        return createSection(
            GENERAL.NOTE,
            createContentWithBullets([t('databases.well-architect.failover-cluster-note1')]),
            { width: '712px' }
        );
    }

    // For managed instances: include authorization note
    return createSection(
        GENERAL.NOTE,
        createContentWithBullets([
            t('databases.well-architect.failover-cluster-note1'),
            t('databases.well-architect.failover-cluster-note2')
        ]),
        { width: '712px' }
    );
};

// Helper function to create drive letter notes section
export const createDriveLetterNotesSection = (t: any) =>
    createSection(GENERAL.NOTE, createContentWithBullets([t('databases.well-architect.drive-letter-note1')]), {
        width: '712px'
    });

// Helper function to create cluster quorum and SQL server notes section
export const createClusterQuorumSQLNotesSection = (t: any, isWad: boolean = false) => {
    if (isWad) {
        // For one-time assessment: only show downtime warning note
        return createSection(GENERAL.NOTE, t('databases.well-architect.failover-cluster-note3'), { width: '712px' });
    }

    // For managed instances: include authorization note
    return createSection(
        GENERAL.NOTE,
        createContentWithBullets([
            t('databases.well-architect.failover-cluster-note3'),
            t('databases.well-architect.failover-cluster-note4')
        ]),
        { width: '712px' }
    );
};

const noticeHelper = (t: TFunction) => (
    <div className={styles.noticeSection}>
        <Info />
        <div className={styles.noticeText}>
            <DsTypography variant="Semibold_14">{t('databases.well-architect.notice-title')}</DsTypography>
            <DsTypography variant="Regular_14">{t('databases.well-architect.notice-description')}</DsTypography>
        </div>
    </div>
);

// Helper function to create standard dialog structure
export const createStandardDialog = (
    t: any,
    actionSummary: string,
    whatWillHappen: string | React.ReactNode,
    notesSection: React.ReactNode,
    configSection?: React.ReactNode,
    assessmentStatus?: boolean,
    isWad: boolean = false
) => (
    <div className={styles['storage-tier-block']}>
        {assessmentStatus && noticeHelper(t)}
        {createSection(t('databases.well-architect.action-summary'), actionSummary)}
        {/* Conditionally render "What will happen" - skip for one-time assessment */}
        {!isWad && createSection(t('databases.well-architect.what-will-happen'), whatWillHappen, { width: '712px' })}
        {configSection}
        {notesSection}
    </div>
);

// Helper function to create failover cluster dialog with multiple action summaries
export const createFailoverClusterDialog = (
    t: any,
    actionSummaries: string[],
    whatWillHappen: string | React.ReactNode,
    configSection?: React.ReactNode,
    notesSection?: React.ReactNode,
    isWad: boolean = false
) => (
    <div className={styles['storage-tier-block']}>
        <div className={styles['first-section']}>
            <DsTypography variant="Semibold_14">{t('databases.well-architect.action-summary')}</DsTypography>
            {actionSummaries.map(summary => (
                <DsTypography key={`action-summary-${summary.slice(0, 30).replace(/\s+/g, '-')}`} variant="Regular_14">
                    {summary}
                </DsTypography>
            ))}
        </div>

        {/* Conditionally render "What will happen" - skip for one-time assessment */}
        {!isWad &&
            whatWillHappen &&
            createSection(t('databases.well-architect.what-will-happen'), whatWillHappen, { width: '712px' })}

        {configSection}

        {notesSection || createFailoverClusterNotesSection(t, isWad)}
    </div>
);

// Helper function to create drive size missing permissions dialog
export const createDriveSizeMissingPermissionsDialog = (t: any, missingPermissionsList: string[]) => (
    <div className={styles['storage-tier-block']}>
        {createSection(
            t('databases.well-architect.action-summary'),
            t('databases.well-architect.drive-size-missing-permission-action-summary')
        )}

        {createSection(
            t('databases.well-architect.action-required'),
            <>
                <DsTypography variant="Regular_14" style={{ width: '712px' }}>
                    {t('databases.well-architect.drive-size-and-headroom-action-content1')}
                </DsTypography>
                {createContentWithBullets([
                    t('databases.well-architect.drive-size-and-headroom-action-content2'),
                    t('databases.well-architect.drive-size-and-headroom-action-content3')
                ])}
                <div className={styles['dialog-body']}>
                    <div className={styles['code-box']}>
                        <div className={styles.code}>
                            <DsTypography variant="Regular_14">
                                {missingPermissionsList.map((permission: string) => (
                                    <DsTypography key={permission} variant="Regular_14">
                                        {permission}
                                    </DsTypography>
                                ))}
                            </DsTypography>
                            <div className={styles.copy}>
                                <CopyToClipboardCommon
                                    value={missingPermissionsList}
                                    iconProvided={
                                        <div className={styles.menuItem}>
                                            <CopyIcon />
                                        </div>
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </>,
            { width: '712px' }
        )}
    </div>
);

// Helper function to create numbered action steps
export const createNumberedActionSteps = (steps: React.ReactNode[]) => (
    <div className={styles['action-section']}>
        {steps.map((step, index) => (
            <div key={`step-${index}`} className={`${styles.row} ${typeof step !== 'string' ? styles['row-top'] : ''}`}>
                <DsTypography variant="Semibold_14">{index + 1}</DsTypography>
                <DsTypography variant="Regular_14">|</DsTypography>
                {typeof step === 'string' ? (
                    <DsTypography variant="Regular_14">{step}</DsTypography>
                ) : (
                    <DsTypography variant="Regular_14" className={styles['step-content']}>
                        {step}
                    </DsTypography>
                )}
            </div>
        ))}
    </div>
);

// Helper function to create action option section with numbered steps
export const createActionOptionSection = (title: string, steps: React.ReactNode[]) => (
    <div className={styles['first-section']}>
        <DsTypography variant="Semibold_14" style={{ width: '712px' }}>
            {title}
        </DsTypography>
        {createNumberedActionSteps(steps)}
    </div>
);
