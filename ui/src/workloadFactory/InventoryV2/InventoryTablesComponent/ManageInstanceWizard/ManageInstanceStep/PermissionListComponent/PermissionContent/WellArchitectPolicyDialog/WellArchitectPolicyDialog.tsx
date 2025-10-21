import { DsTypography, Popover } from '@netapp/design-system';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CopyIcon } from '../../../../../../../../assets/ic_copy.svg';
import styles from './WellArchitectPolicyDialog.module.scss';
import CopyToClipboardCommon from '../../../../../../../../common/CopyToClipboard/copyToClipboard';
import { POLICIES_PERMISSIONS } from '../../../../../../../../utils/consts';

const WellArchitectPolicyDialog = ({ data, label }: any) => {
    const { t } = useTranslation();
    const [selectedTab, setSelectedTab] = useState(t('databases.register-flow.aws-iam-policy-permissions'));
    const [permissionData, setPermissionData] = useState<any>(
        JSON.stringify(
            data?.packages?.find?.((pkg: any) => pkg?.name === POLICIES_PERMISSIONS.VIEW_POLICY)?.permissions,
            null,
            2
        )
    );

    const handleClick = (value: string) => {
        let permissionData: any = '';
        if (value === t('databases.register-flow.aws-iam-policy-permissions')) {
            permissionData = data?.packages?.find?.(
                (pkg: any) => pkg?.name === POLICIES_PERMISSIONS.VIEW_POLICY
            )?.permissions;
        } else if (value === t('databases.register-flow.fsx-for-ontap-permissions')) {
            permissionData = data?.packages?.find?.(
                (pkg: any) => pkg?.name === POLICIES_PERMISSIONS.WELL_ARCHITECTED_FSX__POLICY
            )?.permissions;
        } else if (value === t('databases.register-flow.compute-optimizer-permissions')) {
            permissionData = data?.packages?.find?.(
                (pkg: any) => pkg?.name === POLICIES_PERMISSIONS.WELL_ARCHITECTED_COMPUTE_POLICY
            )?.permissions;
        }
        setPermissionData(JSON.stringify(permissionData, null, 2));
        setSelectedTab(value);
    };
    return (
        <div className={styles.wellArchitectPolicyDialog}>
            <DsTypography variant="Semibold_16">{label}</DsTypography>
            <DsTypography variant="Regular_14">
                {t('databases.register-flow.well-architect-permission-text')}
            </DsTypography>

            <div className={styles.policyTab}>
                <div
                    className={
                        selectedTab === t('databases.register-flow.aws-iam-policy-permissions')
                            ? `${styles.headers} ${styles.headerWidthFirst} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthFirst}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedTab === t('databases.register-flow.aws-iam-policy-permissions')
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick(t('databases.register-flow.aws-iam-policy-permissions'))}
                    >
                        {t('databases.register-flow.aws-iam-policy-permissions')}
                    </DsTypography>
                </div>
                <div
                    className={
                        selectedTab === t('databases.register-flow.fsx-for-ontap-permissions')
                            ? `${styles.headers} ${styles.headerWidthSecond} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthSecond}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedTab === t('databases.register-flow.fsx-for-ontap-permissions')
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick(t('databases.register-flow.fsx-for-ontap-permissions'))}
                    >
                        {t('databases.register-flow.fsx-for-ontap-permissions')}
                    </DsTypography>
                </div>

                <div
                    className={
                        selectedTab === t('databases.register-flow.compute-optimizer-permissions')
                            ? `${styles.headers} ${styles.headerWidthThird} ${styles.active}`
                            : `${styles.headers} ${styles.headerWidthThird}`
                    }
                >
                    <DsTypography
                        variant="Semibold_14"
                        className={
                            selectedTab === t('databases.register-flow.compute-optimizer-permissions')
                                ? `${styles.headerPart1} ${styles.activeText}`
                                : `${styles.headerPart1}`
                        }
                        onClick={() => handleClick(t('databases.register-flow.compute-optimizer-permissions'))}
                    >
                        {t('databases.register-flow.compute-optimizer-permissions')}
                    </DsTypography>
                </div>
            </div>

            <div className={styles['dialog-content']}>
                <div className={styles['dialog-body']}>
                    <div className={styles['code-box']}>
                        <div className={styles.code}>
                            <pre>
                                <DsTypography variant="Regular_14">{permissionData}</DsTypography>
                            </pre>
                        </div>
                        <div className={styles.copy}>
                            <Popover
                                popoverClass={styles['copy-popover']}
                                children={t('databases.general.copied-to-clipboard')}
                                container={
                                    <CopyToClipboardCommon
                                        value={permissionData}
                                        iconProvided={<CopyIcon fill="#A7A7A7" />}
                                    />
                                }
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WellArchitectPolicyDialog;
