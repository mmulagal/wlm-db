import { Button, DsTypography, SelectField, TextField, TooltipInfo, useDialog } from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { ReactComponent as InfoIcon } from '@netapp/icons/ic_info.svg';
import styles from './SavingsSelection.module.scss';
import { generateOptionType } from '../../../../utils/utilityFunctions';
import {
    setMonthlyChangeRate,
    setNumberOfClonedCopies,
    setSelectedCloneRefresh,
    setSelectedMonthlyBYOLCost,
    setSelectedSnapshotFrequency
} from '../../../../store/workloadFactory/exploreSavingsSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import { GENERAL } from '../../../../utils/appConstants';
import { useSearchDebounce } from '../../../../common/hooks/useSearchDebounce';
import { FINDINGS, SAVINGS_CALC_MODE, SNAPSHOT_FREQUENCY, WLF_TABS } from '../../../../utils/consts';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import LearnHowDialog from './LearnHowDialog/LearnHowDialog';
import { checkIfByolFieldRequired } from '../savingsUtil';

const SavingsSelection = ({ printState }: any) => {
    const dispatch = useDispatch();
    const {
        selectedSnapshotFrequency,
        numberOfClonedCopies,
        selectedCloneRefresh,
        monthlyChangeRate,
        loading,
        storageSavingsResponse,
        monthlyBYOLCost,
        selectedHostDetails,
        savingsCalculatorFrom,
        snapshotLoading,
        selectedExploreSavingsTab
    } = useAppSelector(state => state.exploreSavings);

    const [isByolField, setIsByolField] = useState<boolean>(false);
    const [noOfClonedCopies, setNoOfClonedCopies] = useState<any>(numberOfClonedCopies);
    const [monthlyChangeRateNo, setMonthlyChangeRateNo] = useState<any>(monthlyChangeRate);
    const [instanceTypeData, setInstanceTypeData] = useState<any>({
        missingPermissions: false,
        options: [],
        existingInstanceType: ''
    });

    useEffect(() => {
        if (
            savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
        ) {
            setMonthlyChangeRateNo(3);
        }
    }, [savingsCalculatorFrom]);

    // Debounce variable
    const [clonedText, setClonedText] = useSearchDebounce(1000);
    const [changeRateText, setChangeRateText] = useSearchDebounce(1000);
    const [textSearch, setTextSearch] = useSearchDebounce(500);
    const [byolValue, setByolValue] = useState(monthlyBYOLCost || '');

    const { setDialog, closeDialog } = useDialog();

    useEffect(() => {
        setIsByolField(checkIfByolFieldRequired(selectedHostDetails, isByolField, savingsCalculatorFrom));
    }, [selectedHostDetails]);

    // Use effect for machine description
    useEffect(() => {
        setTextSearch(byolValue);
    }, [byolValue]);

    useEffect(() => {
        if (textSearch || monthlyBYOLCost) {
            dispatch(setSelectedMonthlyBYOLCost(textSearch));
        }
    }, [textSearch]);

    useEffect(() => {
        if (savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
            // Handle AUTO_EBS array format
            const computeArray = Array.isArray(storageSavingsResponse?.compute)
                ? storageSavingsResponse.compute
                : [storageSavingsResponse?.compute].filter(Boolean);
            const firstCompute = computeArray[0];

            setInstanceTypeData({
                missingPermissions: firstCompute?.existing?.finding === FINDINGS.INSUFFICIENT_PERMISSIONS,
                options: firstCompute?.recommended?.recommendationOptions || [],
                existingInstanceType: firstCompute?.existing?.instanceType
            });
        } else {
            // Handle single object format for other modes
            setInstanceTypeData({
                missingPermissions:
                    storageSavingsResponse?.compute?.existing?.finding === FINDINGS.INSUFFICIENT_PERMISSIONS,
                options: storageSavingsResponse?.compute?.recommended?.recommendationOptions || [],
                existingInstanceType: storageSavingsResponse?.compute?.existing?.instanceType
            });
        }
    }, [storageSavingsResponse?.compute, savingsCalculatorFrom]);

    useEffect(() => {
        setClonedText(noOfClonedCopies);
    }, [noOfClonedCopies]);

    useEffect(() => {
        setChangeRateText(monthlyChangeRateNo);
    }, [monthlyChangeRateNo]);

    // Debounce variable update
    useEffect(() => {
        if ((clonedText || clonedText === '') && clonedText <= 10) {
            dispatch(setNumberOfClonedCopies(clonedText));
        }
    }, [clonedText]);

    useEffect(() => {
        if ((changeRateText || changeRateText === '') && changeRateText <= 100) {
            dispatch(setMonthlyChangeRate(changeRateText));
        }
    }, [changeRateText]);

    // Function to generate the options for Select Field
    const generateSnapshotFrequency = useMemo<optionType[]>((): optionType[] => {
        const frequency = SNAPSHOT_FREQUENCY;
        const options: optionType[] = [];
        frequency?.map((val, idx: number) => {
            const option = generateOptionType(
                val?.value,
                <div className="savings-calculator-dropdown-options">{val?.label}</div>,
                '',
                false,
                '',
                val
            );
            options.push(option);
        });
        return options;
    }, []);

    useEffect(() => {
        if (
            (!selectedSnapshotFrequency && savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW) ||
            savingsCalculatorFrom === SAVINGS_CALC_MODE.ONPREM
        ) {
            // For FSxW default value is Daily.
            dispatch(setSelectedSnapshotFrequency(generateSnapshotFrequency[2]));
        }
    }, [generateSnapshotFrequency]);

    // Function to generate the options for Select Field
    const generateCloneRefresh = useMemo<optionType[]>((): optionType[] => {
        const frequency = ['Daily', 'Weekly', 'Monthly'];
        const options: optionType[] = [];
        frequency?.map((val, idx: number) => {
            const option = generateOptionType(
                val,
                <div className="savings-calculator-dropdown-options">{val}</div>,
                '',
                false,
                '',
                val
            );
            options.push(option);
        });

        return options;
    }, []);

    useEffect(() => {
        if (!selectedCloneRefresh && savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS) {
            dispatch(setSelectedCloneRefresh(generateCloneRefresh[0]));
        }
    }, [generateCloneRefresh]);

    const errorForClonedCopiesCount = () => {
        if (noOfClonedCopies > 10) {
            return GENERAL.CLONED_COPIES_MAX_LIMIT;
        }
    };

    const errorForChangeRate = () => {
        if (monthlyChangeRateNo > 100) {
            return GENERAL.CHANGE_RATE_MAX_LIMIT;
        }
    };

    const handleLearnHowClick = () => {
        setDialog(
            <DialogComponent
                header={GENERAL.LEARN_HOW_DIALOG.TITLE}
                content={<LearnHowDialog type="tco" />}
                primaryButton={GENERAL.CLOSE}
                callback={() => closeDialog()}
            />
        );
    };

    return (
        <>
            {selectedExploreSavingsTab === WLF_TABS.MSSQL_ON_PREMISES && (
                <div
                    className={styles.savingsSelection}
                    id="savings-calculator-input-group"
                    style={{ marginBottom: '20px' }}
                >
                    <DsTypography variant="Regular_14">Snapshot & clones</DsTypography>

                    <DsTypography variant="Regular_14" style={{ marginTop: '16px' }}>
                        Provide clone and snapshot values to calculate the cost savings.
                    </DsTypography>

                    <div className={styles.firstRow}>
                        <SelectField
                            label={GENERAL.ES_SNAPSHOT_FREQUENCY}
                            isDisabled={loading}
                            isClearable={false}
                            value={selectedSnapshotFrequency}
                            onChange={(selectedOptions: any): void => {
                                dispatch(setSelectedSnapshotFrequency(selectedOptions));
                            }}
                            info={
                                selectedSnapshotFrequency &&
                                selectedSnapshotFrequency?.label === GENERAL.ES_NO_SNAPSHOT_STORAGE &&
                                GENERAL.TOOLTIP_MESSAGE_SNAPSHOT_FREQ
                            }
                            isLoading={snapshotLoading}
                            isSearchable={generateSnapshotFrequency.length > 5}
                            options={generateSnapshotFrequency}
                            className={`${styles.widthSetOnPrem} savings-calculator-input-fields`}
                        />

                        {printState && (
                            <div className={styles.mockInputClone}>
                                <DsTypography variant="Regular_14" className={styles.mockLabel}>
                                    {GENERAL.NUMBER_OF_CLONED_COPIES}
                                </DsTypography>
                                <div className={styles.inputField}>{noOfClonedCopies}</div>
                            </div>
                        )}
                        {!printState && (
                            <TextField
                                label={GENERAL.NUMBER_OF_CLONED_COPIES}
                                isDisabled={loading}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                    setNoOfClonedCopies(numVal);
                                }}
                                value={noOfClonedCopies}
                                className={`${styles.widthSetOnPrem} savings-calculator-input-fields`}
                                error={errorForClonedCopiesCount()}
                            />
                        )}
                    </div>

                    <div className={`${styles.secondRow} ${styles.infoCenter}`}>
                        {printState && (
                            <div className={styles.mockInput}>
                                <DsTypography variant="Regular_14" className={styles.mockLabel}>
                                    {GENERAL.MONTHLY_CHANGE_RATE}
                                </DsTypography>
                                <div className={styles.inputField}>{monthlyChangeRateNo}</div>
                            </div>
                        )}
                        {!printState && (
                            <TextField
                                label={GENERAL.MONTHLY_CHANGE_RATE}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                    setMonthlyChangeRateNo(numVal);
                                }}
                                isDisabled={loading}
                                value={monthlyChangeRateNo || ''}
                                className={`${styles.widthSetOnPrem} savings-calculator-input-fields`}
                                info={GENERAL.MONTHLY_CHANGE_RATE_TOOLTIP}
                                error={errorForChangeRate()}
                            />
                        )}
                    </div>
                </div>
            )}
            {selectedExploreSavingsTab !== WLF_TABS.MSSQL_ON_PREMISES && (
                <div className={styles.savingsSelection} id="savings-calculator-input-group">
                    <DsTypography variant="Regular_14">{GENERAL.ES_SAVINGS_SELECTION_TEXT}</DsTypography>

                    <div className={styles.firstRow}>
                        <SelectField
                            label={GENERAL.ES_SNAPSHOT_FREQUENCY}
                            isDisabled={loading}
                            isClearable={false}
                            value={selectedSnapshotFrequency}
                            onChange={(selectedOptions: any): void => {
                                dispatch(setSelectedSnapshotFrequency(selectedOptions));
                            }}
                            info={
                                selectedSnapshotFrequency &&
                                selectedSnapshotFrequency?.label === GENERAL.ES_NO_SNAPSHOT_STORAGE &&
                                GENERAL.TOOLTIP_MESSAGE_SNAPSHOT_FREQ
                            }
                            isLoading={snapshotLoading}
                            isSearchable={generateSnapshotFrequency.length > 5}
                            options={generateSnapshotFrequency}
                            className={`${styles.widthSet} savings-calculator-input-fields`}
                        />
                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_FSXW ? (
                            printState ? (
                                <div className={styles.mockInput}>
                                    <DsTypography variant="Regular_14" className={styles.mockLabel}>
                                        {GENERAL.NUMBER_OF_CLONED_COPIES}
                                    </DsTypography>
                                    <div className={styles.inputField}>{noOfClonedCopies}</div>
                                </div>
                            ) : (
                                <TextField
                                    label={GENERAL.NUMBER_OF_CLONED_COPIES}
                                    isDisabled={loading}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                        setNoOfClonedCopies(numVal);
                                    }}
                                    value={noOfClonedCopies}
                                    className={`${styles.widthSet} savings-calculator-input-fields`}
                                    error={errorForClonedCopiesCount()}
                                />
                            )
                        ) : (
                            ''
                        )}
                    </div>

                    <div className={styles.secondRow}>
                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS &&
                            (printState ? (
                                <div className={styles.mockInput}>
                                    <DsTypography variant="Regular_14" className={styles.mockLabel}>
                                        {GENERAL.NUMBER_OF_CLONED_COPIES}
                                    </DsTypography>
                                    <div className={styles.inputField}>{noOfClonedCopies}</div>
                                </div>
                            ) : (
                                <TextField
                                    label={GENERAL.NUMBER_OF_CLONED_COPIES}
                                    isDisabled={loading}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                        setNoOfClonedCopies(numVal);
                                    }}
                                    value={noOfClonedCopies}
                                    className={`${styles.widthSet} savings-calculator-input-fields`}
                                    error={errorForClonedCopiesCount()}
                                />
                            ))}
                        {savingsCalculatorFrom === SAVINGS_CALC_MODE.AUTO_EBS && (
                            <SelectField
                                label={GENERAL.ES_CLONE_REFRESH_FREQUENCY}
                                isClearable={false}
                                isDisabled={loading}
                                defaultValue={selectedCloneRefresh || [generateCloneRefresh[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setSelectedCloneRefresh(selectedOptions));
                                }}
                                isSearchable={generateCloneRefresh.length > 5}
                                options={generateCloneRefresh}
                                className={`${styles.widthSet} savings-calculator-input-fields`}
                            />
                        )}
                    </div>

                    <div className={`${styles.secondRow} ${styles.infoCenter}`}>
                        {printState && (
                            <div className={styles.mockInput}>
                                <DsTypography variant="Regular_14" className={styles.mockLabel}>
                                    {GENERAL.MONTHLY_CHANGE_RATE}
                                </DsTypography>
                                <div className={styles.inputField}>{monthlyChangeRateNo}</div>
                            </div>
                        )}
                        {!printState && (
                            <TextField
                                label={GENERAL.MONTHLY_CHANGE_RATE}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                    setMonthlyChangeRateNo(numVal);
                                }}
                                isDisabled={loading}
                                value={monthlyChangeRateNo || ''}
                                className={`${styles.widthSet} savings-calculator-input-fields`}
                                info={GENERAL.MONTHLY_CHANGE_RATE_TOOLTIP}
                                error={errorForChangeRate()}
                            />
                        )}
                        <div className={styles.notice}>
                            <div className={styles.setSVG}>
                                <InfoIcon />
                            </div>
                            <DsTypography variant="Regular_14" className={styles.contentWidth}>
                                {GENERAL.REFER_SNAPSHOTS}
                            </DsTypography>
                        </div>
                    </div>
                    {/* Hide these fields for AUTO_EBS mode since they will be shown per-host in TCOBulkAccordion */}
                    {savingsCalculatorFrom !== SAVINGS_CALC_MODE.AUTO_EBS && (
                        <div className={styles.secondRow}>
                            {isByolField && (
                                <TextField
                                    label={GENERAL.BYOL_TEXT}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                        const numVal = e.target.value.replace(/[^0-9.]/g, '');
                                        setByolValue(numVal);
                                    }}
                                    isOptional
                                    value={byolValue}
                                    className={`${styles.deploymentModelWidth} savings-calculator-input-fields`}
                                />
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default SavingsSelection;
