import { DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import classNames from 'classnames';

import { INVENTORY_STATUS } from '../../utils/consts';

import styles from './InventoryStatusIndicator.module.scss';

type StatusCategory = 'online' | 'offline' | 'unknown' | null;

const ONLINE_STATUSES = new Set(['online', 'running', 'up']);
const OFFLINE_STATUSES = new Set(['offline', 'stopped', 'down']);

function getStatusCategory(status?: string): StatusCategory {
    if (!status) return null;
    const lower = status.toLowerCase();
    if (ONLINE_STATUSES.has(lower)) return 'online';
    if (OFFLINE_STATUSES.has(lower)) return 'offline';
    if (lower === 'unknown') return 'unknown';
    return null;
}

function getStatusDisplayText(status: string, category: StatusCategory): string {
    if (category === 'online') return INVENTORY_STATUS.ONLINE;
    if (category === 'offline') return INVENTORY_STATUS.OFFLINE;
    return status;
}

interface InventoryStatusIndicatorProps {
    status?: string;
    loading?: boolean;
    isWad?: boolean;
    isUnregistered?: boolean;
    typographyClassName?: string;
}

const InventoryStatusIndicator = ({
    status,
    loading,
    isWad,
    isUnregistered,
    typographyClassName
}: InventoryStatusIndicatorProps) => {
    const category = getStatusCategory(status);
    const shouldShowUnknownStatus = !isWad && !isUnregistered;

    return (
        <>
            {category && <div className={classNames(styles.statusIcon, styles.circle, styles[category])} />}
            <DsTypography variant="Regular_13" className={typographyClassName}>
                {status && getStatusDisplayText(status, category)}
                {!status && loading && <DsFlashingDotsLoader />}
                {!status && !loading && shouldShowUnknownStatus && INVENTORY_STATUS.UNKNOWN}
            </DsTypography>
        </>
    );
};

export default InventoryStatusIndicator;
