import { useEffect, useMemo } from 'react';
import { AccordionCard, AccordionCardContent, Typography } from '@netapp/design-system';
import { optionType, SelectField } from '@netapp/design-system/dist/components/Select';
import { useDispatch } from 'react-redux';
import { GENERAL } from '../../../../utils/appConstants';
import styles from './InstanceType.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { formatSize, generateOptionType, sortListOfDict } from '../../../../utils/utilityFunctions';
import { useAppSelector } from '../../../../store/storeHooks';
import { setInstanceType } from '../../../../store/mssql/mssqlFormSlice';
import { DEAFULT_INSTANCE_VALUE } from '../../../../utils/consts';
import { setIsAutoRecommendedSelection, setIsRecommendedInstance } from '../../../../store/mssql/msSqlActionSlice';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import {
    getRecommendedInstanceTypeForCapacity,
    MSSQL_AUTO_OVERWRITABLE_INSTANCE_TYPES
} from '../../MSSqlServer/MSSqlUtils';

const InstanceType = () => {
    const dispatch = useDispatch();

    // Getting the Data from state
    const { instanceTypeData, instanceTypeLoading } = useAppSelector(state => state.mssql.getInstanceTypeList);
    const selectedInstanceType = useAppSelector(state => state.mssqlForm.instanceType);
    const selectedLicense = useAppSelector(state => state.mssqlForm.license.selectedLicenseId);

    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);
    const isRecommendedInstance = useAppSelector(state => state.msSqlAction.isRecommendedInstance);
    const isAutoRecommendedSelection = useAppSelector(state => state.msSqlAction.isAutoRecommendedSelection);
    const storageCapacity = useAppSelector(state => state.mssqlForm.storageCapacity?.capacity);
    const storageUnitLabel = useAppSelector(state => state.mssqlForm.storageCapacity?.unit?.value ?? state.mssqlForm.storageCapacity?.unit?.label ?? state.mssqlForm.storageCapacity?.unit);

    // Function to generate the options for Select Field
    const generateInstances = useMemo<optionType[]>((): optionType[] => {
        let options: optionType[] = [];
        let default_instance_item = null;
        const archVal = selectedLicense?.data?.architecture;
        instanceTypeData?.instanceTypes?.map((val, idx: number) => {
            const value = val?.instanceType || '';
            let label2 = '';
            if (val?.vCpus) {
                label2 += `${val?.vCpus}vCPU, `;
            }
            if (val?.ramInMib) {
                label2 += `${formatSize(val?.ramInMib, 'mib')} RAM, `;
            }
            if (val?.iopsInMbps) {
                label2 += `${val?.iopsInMbps}Mbps`;
            }
            const option = generateOptionType(value, value, label2, false, '', val);
            if (value === DEAFULT_INSTANCE_VALUE) {
                default_instance_item = option;
            } else if (!archVal || (archVal && val?.architecture && val.architecture.includes(archVal))) {
                options.push(option);
            }
        });

        options = sortListOfDict(options, 'value');
        if (default_instance_item) {
            options.unshift(default_instance_item);
        }
        return options;
    }, [instanceTypeData, selectedLicense]);

    useEffect(() => {
        // If isRecommendedInstance is present that set that value as default. This case is when we load recommended templates.
        if (isRecommendedInstance && instanceTypeData && instanceTypeData?.instanceTypes) {
            dispatch(setInstanceType(isRecommendedInstance));
            dispatch(setIsRecommendedInstance(null));
            // A preset tile locks in its own instance type; subsequent capacity
            // edits must not silently overwrite it via the size-based effect.
            dispatch(setIsAutoRecommendedSelection(false));
        } else if (!isLoadConfig && !isRecommendedInstance) {
            const newInstanceList = generateInstances?.filter(perRow => perRow?.label === selectedInstanceType?.label);
            if (!selectedInstanceType || !newInstanceList?.length) {
                dispatch(setInstanceType(generateInstances?.[0]));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateInstances]);

    // Size-based auto-recommendation: while the user has not made an explicit
    // selection (manual pick, preset tile, or loaded config), keep the instance
    // type aligned with the entered database size. Guarded so we never override
    // anything outside the auto-overwritable set, and skipped entirely until
    // the user has actually entered a capacity (avoids an empty-state -> SMALL
    // dispatch immediately followed by a debounce-driven correction).
    useEffect(() => {
        if (
            !isAutoRecommendedSelection ||
            isLoadConfig ||
            isRecommendedInstance ||
            !storageCapacity ||
            !generateInstances?.length
        ) {
            return;
        }
        const currentValue = selectedInstanceType?.value;
        if (currentValue && !MSSQL_AUTO_OVERWRITABLE_INSTANCE_TYPES.has(currentValue)) {
            return;
        }
        const recommendedType = getRecommendedInstanceTypeForCapacity(storageCapacity, storageUnitLabel);
        if (currentValue === recommendedType) {
            return;
        }
        // Look the option up in the already-built (and architecture-filtered)
        // dropdown list so the auto-recommendation always matches what the
        // user can actually pick. If the recommendation isn't available in
        // this region/license combo, leave the existing selection alone.
        const optionFromList = generateInstances.find(opt => opt?.value === recommendedType);
        if (!optionFromList) {
            return;
        }
        dispatch(setInstanceType(optionFromList));
    }, [
        storageCapacity,
        storageUnitLabel,
        generateInstances,
        isAutoRecommendedSelection,
        isLoadConfig,
        isRecommendedInstance,
        selectedInstanceType?.value,
        dispatch
    ]);

    // Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <Typography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </Typography>
            );
        }
        return <Typography variant="Regular_14">{selectedInstanceType?.label}</Typography>;
    };
    return (
        <div className={styles['instance-type']}>
            <AccordionCard
                isLoading={instanceTypeLoading}
                isDisabled={!credentialData || (credentialData && !credentialData.length)}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length)}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="14"
                title={<div className={CommonStyles.title}>{GENERAL.INSTANCE_TYPE}</div>}
            >
                <AccordionCardContent>
                    <Typography>
                        <div className={styles.handleSelect}>
                            <SelectField
                                label={GENERAL.INSTANCE_TYPE}
                                isClearable={false}
                                defaultValue={selectedInstanceType ? [selectedInstanceType] : [generateInstances[0]]}
                                onChange={(selectedOptions: any): void => {
                                    dispatch(setInstanceType(selectedOptions));
                                    dispatch(setIsAutoRecommendedSelection(false));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                isSearchable={generateInstances.length > 5}
                                options={generateInstances}
                                variant="two-lines"
                                className={styles.changeColor}
                            />
                        </div>
                    </Typography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};

export default InstanceType;
