import { DsButton, DsTypography } from '@tlveng/wlm-ds';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { ReactComponent as Union } from '../../../../../assets/Union.svg';
import styles from './FilterComponent.module.scss';

import TimeDropdown from './TimeDropDown';
import { resetEiFilters } from '../../../../../store/workloadFactory/agenticAISlice';
import { useAppSelector } from '../../../../../store/storeHooks';
import { eiErrorCodesOptions, eiSeverityOptionList, eiTimeOptions } from '../ErrorInvestigationUtility';

const FilterComponent = () => {
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
    const { errorInvestigationLoading } = useAppSelector(state => state.agenticAI.errorInvestigation);
    const loading = investigationDatesLoading || errorInvestigationLoading;

    const severityOptionList = [
        eiSeverityOptionList?.all,
        eiSeverityOptionList?.top5,
        eiSeverityOptionList?.['16-24'],
        eiSeverityOptionList?.['9-15'],
        eiSeverityOptionList?.['1-8']
    ];

    const errorCodesOptions = [eiErrorCodesOptions?.all, eiErrorCodesOptions?.top10, eiErrorCodesOptions?.top5];

    const timeOptions = [
        eiTimeOptions?.last24,
        eiTimeOptions?.last12,
        eiTimeOptions?.last6,
        eiTimeOptions?.last1,
        eiTimeOptions?.custom
    ];

    useEffect(() => {
        dispatch(
            resetEiFilters({
                selectedTimeFrame: timeOptions[0],
                selectedSeverity: severityOptionList[1],
                selectedErrorCodes: errorCodesOptions[0]
            })
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={styles.filterComponent}>
            <div className={styles.leftSide}>
                <div className={styles.item}>
                    <div className={loading || noData || noErrorsDetected ? styles.disabled : ''}>
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
            </div>
            <div className={styles.rightSide}>
                <DsButton
                    isDisabled={loading || noData || noErrorsDetected}
                    type="text"
                    onClick={() => {
                        dispatch(
                            resetEiFilters({
                                selectedTimeFrame: timeOptions[0],
                                selectedSeverity: severityOptionList[1],
                                selectedErrorCodes: errorCodesOptions[0]
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
