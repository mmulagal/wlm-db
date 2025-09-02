import { DsButton, DsFlashingDotsLoader, DsTypography } from '@tlveng/wlm-ds';
import { useDispatch } from 'react-redux';
import styles from './BannerCard.module.scss';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import { setSelectedInventoryTab } from '../../../../store/workloadFactory/inventoryV2Slice';
import {
    setNotActiveSQLInstancesView,
    setNotOptimizedOracleDatabaseView,
    setNotOptimizedSQLInstancesView,
    setNotRegisteredOracleDatabasesView,
    setNotRegisteredSQLView
} from '../../../../store/workloadFactory/inventorybannerSlice';
import { INVENTORY_BANNER_FILTER_OPTIONS } from '../../../../utils/consts';

type BannerCardProps = {
    Image?: any;
    topText?: string;
    text2?: string;
    text3?: string;
    value1?: string | number;
    value2?: string | number;
    viewFilterOption?: string;
    loading?: boolean;
};

const BannerCard = ({ Image, topText, text2, text3, value1, value2, viewFilterOption, loading }: BannerCardProps) => {
    const dispatch = useDispatch();
    const handleClick = () => {
        // MSSQL filters
        if (viewFilterOption === INVENTORY_BANNER_FILTER_OPTIONS.NOT_REGISTERED_INSTANCES) {
            dispatch(setSelectedInventoryTab('Instances'));
            dispatch(setNotRegisteredSQLView(true));
        }
        if (viewFilterOption === INVENTORY_BANNER_FILTER_OPTIONS.NOT_ACTIVE_INSTANCES) {
            dispatch(setSelectedInventoryTab('Instances'));
            dispatch(setNotActiveSQLInstancesView(true));
        }
        if (viewFilterOption === INVENTORY_BANNER_FILTER_OPTIONS.NOT_OPTIMIZED_INSTANCE_SQL) {
            dispatch(setSelectedInventoryTab('Instances'));
            dispatch(setNotOptimizedSQLInstancesView(true));
        }

        // Oracle filters
        if (viewFilterOption === INVENTORY_BANNER_FILTER_OPTIONS.NOT_REGISTERED_DATABASES) {
            dispatch(setSelectedInventoryTab('Instances'));
            dispatch(setNotRegisteredOracleDatabasesView(true));
        }

        if (viewFilterOption === INVENTORY_BANNER_FILTER_OPTIONS.NOT_OPTIMIZED_DATABASES) {
            dispatch(setSelectedInventoryTab('Instances'));
            dispatch(setNotOptimizedOracleDatabaseView(true));
        }
    };
    return (
        <div className={styles.card}>
            <div className={styles.cardTopSection}>
                <Image />
                <DsTypography variant="Semibold_16">{topText}</DsTypography>
            </div>
            <div className={styles.cardBottomSection}>
                <div className={styles.cardTextSection}>
                    <div className={styles.cardValue}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {value1}
                        </DsTypography>
                        {loading && (
                            <div className={styles.loaderClass}>
                                <DsFlashingDotsLoader />
                            </div>
                        )}
                    </div>
                    <DsTypography variant="Regular_14">{text2}</DsTypography>
                </div>

                <SeparatorComponent variant="vertical" height="56px" />

                <div className={styles.cardTextSection}>
                    <div className={styles.cardValue}>
                        <DsTypography variant="Regular_32" style={{ lineHeight: 'unset' }}>
                            {value2}
                        </DsTypography>
                        {loading && (
                            <div className={styles.loaderClass}>
                                <DsFlashingDotsLoader />
                            </div>
                        )}
                    </div>
                    <div className={styles.withView}>
                        <DsTypography variant="Regular_14">{text3}</DsTypography>
                        <DsButton type="text" onClick={handleClick} isDisabled={loading}>
                            View
                        </DsButton>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BannerCard;
