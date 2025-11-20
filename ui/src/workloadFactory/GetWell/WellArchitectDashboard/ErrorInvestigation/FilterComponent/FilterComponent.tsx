import { DsButton, DsTypography } from '@tlveng/wlm-ds';
import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { ReactComponent as Union } from '../../../../../assets/Union.svg';
import styles from './FilterComponent.module.scss';

import TimeDropdown from './TimeDropDown';
import { resetEiFilters } from '../../../../../store/workloadFactory/agenticAISlice';
import { useAppSelector } from '../../../../../store/storeHooks';
import {
    eiErrorCodesOptions,
    eiSeverityOptionList,
    eiSeverityOptionListOracle,
    eiTimeOptions
} from '../ErrorInvestigationUtility';
import { DBType } from '../../../../../utils/consts';

const FilterComponent = ({ dbType }: { dbType: string }) => {
    const { t } = useTranslation();
    const dispatch = useDispatch();

    const {
        noData,
        selectedSeverity,
        selectedTimeFrame,
        selectedErrorCodes,
        investigationDatesLoading,
        noErrorsDetected
    } = useAppSelector(state => state.agenticAI);
    const isDarkTheme = useAppSelector(state => state?.auth?.features?.active['Platform.BlueXP/DarkTheme']);
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const loading = investigationDatesLoading || errorInvestigationLoading;

    const severityOptionList = useMemo(() => {
        if (dbType === DBType.ORACLE) {
            return [
                eiSeverityOptionListOracle?.all,
                eiSeverityOptionListOracle?.critical,
                eiSeverityOptionListOracle?.severe,
                eiSeverityOptionListOracle?.important
            ];
        }
        return [
            eiSeverityOptionList?.all,
            eiSeverityOptionList?.top5,
            eiSeverityOptionList?.['16-24'],
            eiSeverityOptionList?.['9-15'],
            eiSeverityOptionList?.['1-8']
        ];
    }, [dbType]);

    const errorCodesOptions = [eiErrorCodesOptions?.all, eiErrorCodesOptions?.top10, eiErrorCodesOptions?.top5];

    const timeOptions = [
        eiTimeOptions?.last24,
        eiTimeOptions?.last12,
        eiTimeOptions?.last6,
        eiTimeOptions?.last1,
        eiTimeOptions?.custom
    ];

    const generateTagOptions = () => [
        { id: '1', label: t('databases.log-analyzer.Compute'), value: 'Compute' },
        { id: '2', label: t('databases.log-analyzer.Storage'), value: 'Storage' },
        { id: '3', label: t('databases.log-analyzer.Network'), value: 'Network' },
        { id: '4', label: t('databases.log-analyzer.Security'), value: 'Security' }
    ];

    useEffect(() => {
        dispatch(
            resetEiFilters({
                selectedTimeFrame: timeOptions[0],
                selectedSeverity: dbType === DBType.ORACLE ? severityOptionList[0] : severityOptionList[1],
                selectedErrorCodes: errorCodesOptions[0],
                selectedErrorTags: ['Storage', 'Compute', 'Network', 'Security']
            })
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={styles.filterComponent}>
            <div className={styles.leftSide}>
                <div className={styles.item}>
                    <div
                        className={`${loading || noData || noErrorsDetected ? styles.disabled : ''} ${
                            isDarkTheme ? styles.darkSupport : ''
                        }`}
                    >
                        <Union />
                    </div>

                    <DsTypography
                        className={loading || noData || noErrorsDetected ? styles.disabled : ''}
                        variant="Semibold_14"
                    >
                        {t('databases.log-analyzer.filters')}:
                    </DsTypography>
                </div>

                <div className={styles.itemDropDownItem}>
                    <DsTypography
                        className={loading || noData || noErrorsDetected ? styles.disabled : ''}
                        variant="Regular_14"
                    >
                        {t('databases.log-analyzer.severity')}:
                    </DsTypography>
                    <TimeDropdown
                        options={severityOptionList}
                        dropDownType="severity"
                        selectedValue={selectedSeverity}
                        width="294px"
                    />
                </div>
                <div className={styles.itemDropDownItem}>
                    <DsTypography
                        className={loading || noData || noErrorsDetected ? styles.disabled : ''}
                        variant="Regular_14"
                    >
                        {t('databases.log-analyzer.timeframe')}:
                    </DsTypography>
                    <TimeDropdown options={timeOptions} dropDownType="timeFrame" selectedValue={selectedTimeFrame} />
                </div>
                <div className={styles.itemDropDownItem}>
                    <DsTypography
                        className={loading || noData || noErrorsDetected ? styles.disabled : ''}
                        variant="Regular_14"
                    >
                        {t('databases.log-analyzer.error-codes')}:
                    </DsTypography>
                    <TimeDropdown
                        options={errorCodesOptions}
                        dropDownType="errorCodes"
                        selectedValue={selectedErrorCodes}
                    />
                </div>

                <div className={styles.itemDropDownItem}>
                    <DsTypography
                        className={loading || noData || noErrorsDetected ? styles.disabled : ''}
                        variant="Regular_14"
                    >
                        {t('databases.log-analyzer.tags')}:
                    </DsTypography>
                    <TimeDropdown
                        options={generateTagOptions().map(option => option.value)}
                        dropDownType="tags"
                        selectedValue={selectedErrorCodes}
                    />
                </div>
            </div>
            <div className={styles.rightSide}>
                <DsButton
                    isDisabled={loading || noData || noErrorsDetected}
                    type="text"
                    onClick={() => {
                        dispatch(
                            resetEiFilters({
                                selectedTimeFrame: timeOptions[0],
                                selectedSeverity:
                                    dbType === DBType.ORACLE ? severityOptionList[0] : severityOptionList[1],
                                selectedErrorCodes: errorCodesOptions[0],
                                selectedErrorTags: ['Storage', 'Compute', 'Network', 'Security']
                            })
                        );
                    }}
                >
                    {t('databases.log-analyzer.reset')}
                </DsButton>
            </div>
        </div>
    );
};

export default FilterComponent;
