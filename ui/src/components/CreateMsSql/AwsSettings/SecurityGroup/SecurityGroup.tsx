import { useEffect, useMemo, useState } from 'react';
import {
    AccordionCard,
    AccordionCardContent,
    DsButton,
    DsSelect,
    DsTypography,
    useDialog
} from '@netapp/design-system';
import { optionType } from '@netapp/design-system/dist/components/Select';
import { DsToggleSwitch } from '@tlveng/wlm-ds';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { GENERAL, SELECT_CONFIG } from '../../../../utils/appConstants';
import { MAX_SG_SELECTION } from '../../../../utils/consts';
import styles from './SecurityGroup.module.scss';
import CommonStyles from '../../../../utils/CommonStyles.module.scss';
import { generateMultipleOptionType } from '../../../../utils/utilityFunctions';
import { setSelectedExistingSecurityGroup } from '../../../../store/mssql/mssqlFormSlice';
import { useAppSelector } from '../../../../store/storeHooks';
import ActionRequired from '../../../../common/ActionRequired/ActionRequired';
import { setIsWizardTouched } from '../../../../store/chatbot/chatbotSlice';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import SecurityGroupRulesTable from './SecurityGroupRulesTable';

const SecurityGroup = () => {
    const dispatch = useDispatch();
    const { t } = useTranslation();
    const { setDialog } = useDialog();

    const { sgData, sgLoading } = useAppSelector(state => state.mssql.getSGList);

    // Getting selected VPC to get security groups for selected VPC
    const selectedVPCData = useAppSelector(state => state.mssqlForm.regionAndVpc.selectedVPC);
    const isLoadConfig = useAppSelector(state => state.msSqlAction.isLoadConfig);

    const { credentialData } = useAppSelector(state => state.mssql.getCredentials);

    // Getting selected security group
    const selectedExistingSecurityGroup = useSelector(
        (state: any) => state.mssqlForm.securityGroup.selectedExistingSecurityGroup
    );

    const [isAdditionalSGEnabled, setIsAdditionalSGEnabled] = useState(false);
    const [pendingSelectedIds, setPendingSelectedIds] = useState<(string | number)[]>([]);

    const committedIds = useMemo(
        () =>
            Array.isArray(selectedExistingSecurityGroup)
                ? selectedExistingSecurityGroup.map((sg: any) => sg?.id || sg?.value || '')
                : [],
        [selectedExistingSecurityGroup]
    );

    // Function to generate the options for Select Field
    const generateExistingSecurity = useMemo<optionType[]>((): optionType[] => {
        const options: optionType[] = [];
        sgData?.securityGroups?.map((val: any) => {
            const sgValue = val?.id;
            const sgLabel = val?.securityGroupName || val?.name || '-';
            const displayText = `${sgValue} | ${sgLabel}`;
            const option = generateMultipleOptionType(displayText, displayText, sgValue, false, '', val);
            options.push(option);
        });
        return options;
    }, [sgData]);

    // Stable options with onClick to mirror DsSelect's internal check/uncheck for limit tracking
    const sgOptionsWithLimit = useMemo<any[]>(
        () =>
            generateExistingSecurity.map(opt => {
                const optId = (opt as any).id?.toString() || '';
                return {
                    ...opt,
                    onClick: () => {
                        setPendingSelectedIds(prev => {
                            const prevStr = prev.map(id => id?.toString() || '');
                            if (prevStr.includes(optId)) {
                                return prev.filter(id => id?.toString() !== optId);
                            }
                            if (prev.length >= MAX_SG_SELECTION) return prev;
                            return [...prev, (opt as any).id];
                        });
                    }
                };
            }),
        [generateExistingSecurity]
    );

    // Derived from pendingSelectedIds — disables options beyond the MAX_SG_SELECTION limit
    const sgOptionsWithDisabled = useMemo<any[]>(() => {
        const selectedIdSet = new Set(pendingSelectedIds.map(id => id?.toString() || ''));
        const limitReached = pendingSelectedIds.length >= MAX_SG_SELECTION;
        return sgOptionsWithLimit.map(opt => {
            const optId = (opt as any).id?.toString() || '';
            const isDisabled = limitReached && !selectedIdSet.has(optId);
            return {
                ...opt,
                isDisabled,
                disabledReason: isDisabled
                    ? t('databases.general.security-group-max-selection', { max: MAX_SG_SELECTION })
                    : ''
            };
        });
    }, [sgOptionsWithLimit, pendingSelectedIds, t]);

    // Sync pending to committed when committed selection changes (after Apply) or SG data changes
    useEffect(() => {
        setPendingSelectedIds(committedIds);
    }, [committedIds, generateExistingSecurity]);

    useEffect(() => {
        if (!isLoadConfig) {
            dispatch(setSelectedExistingSecurityGroup([]));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [generateExistingSecurity]);

    // Auto-enable toggle when a loaded config has pre-selected security groups
    useEffect(() => {
        if (isLoadConfig && committedIds.length > 0) {
            setIsAdditionalSGEnabled(true);
        }
    }, [isLoadConfig, committedIds]);

    // eslint-disable-next-line consistent-return -- must return undefined (not a string) so DsSelect shows placeholder styling
    const labelForSGSelect = () => {
        if (selectedExistingSecurityGroup && selectedExistingSecurityGroup.length === 1) {
            const sg = selectedExistingSecurityGroup[0];
            return sg?.data?.id || sg?.id || sg?.value || '';
        }
        if (selectedExistingSecurityGroup && selectedExistingSecurityGroup.length > 1) {
            return t('databases.general.security-group-count-selected', {
                count: selectedExistingSecurityGroup.length
            });
        }
    };

    // Set the Header text here
    const setHeader = () => {
        if (!credentialData || (credentialData && !credentialData.length)) {
            return (
                <DsTypography variant="Regular_14" className={CommonStyles['text-disabled']}>
                    {GENERAL.SELECT_ANY_ACCOUNT}
                </DsTypography>
            );
        }
        if (!selectedVPCData) {
            return <ActionRequired disabled />;
        }
        const sgsArray: any[] = Array.isArray(selectedExistingSecurityGroup) ? selectedExistingSecurityGroup : [];
        const sg = sgsArray[0];
        const additionalLabel =
            sgsArray.length > 1
                ? t('databases.general.security-group-count-selected', { count: sgsArray.length })
                : sg?.data?.id || sg?.id || sg?.label || '';
        return (
            <div className={styles.setHeaderStyle}>
                <div>{t('databases.general.new-security-group')}</div>
                {additionalLabel && (
                    <>
                        <div className={styles.separator} />
                        <div>{additionalLabel}</div>
                    </>
                )}
            </div>
        );
    };
    const openViewRulesDialog = () => {
        setDialog(
            <DialogComponent
                header={t('databases.general.security-group-rules-dialog-header')}
                content={<SecurityGroupRulesTable />}
                primaryButton={t('databases.general.close')}
                callback={() => {}}
            />
        );
    };

    return (
        <div className={styles['security-group']}>
            <AccordionCard
                isDisabled={!credentialData || (credentialData && !credentialData.length) || !selectedVPCData}
                isExpandDisabled={!credentialData || (credentialData && !credentialData.length) || !selectedVPCData}
                isLoading={sgLoading}
                ValueContent={() => <div className={CommonStyles['heading-content']}>{setHeader()}</div>}
                id="4"
                title={<div className={CommonStyles.title}>{SELECT_CONFIG.SECURITY_GROUP}</div>}
            >
                <AccordionCardContent>
                    <DsTypography>
                        <div className={styles.descriptionBlock}>
                            <div className={styles.descriptionTextRow}>
                                <DsTypography variant="Regular_14" className={styles.descriptionText}>
                                    {t('databases.general.security-group-new-sg-description')}
                                </DsTypography>
                                <DsButton type="text" onClick={openViewRulesDialog}>
                                    {t('databases.general.security-group-view-rules')}
                                </DsButton>
                            </div>
                        </div>
                        <div className={styles.toggleRow}>
                            <DsToggleSwitch
                                value={isAdditionalSGEnabled}
                                title={t('databases.general.add-additional-security-group')}
                                onChange={(checked: boolean) => {
                                    setIsAdditionalSGEnabled(checked);
                                    if (!checked) {
                                        dispatch(setSelectedExistingSecurityGroup([]));
                                        dispatch(setIsWizardTouched(true));
                                    }
                                }}
                            />
                        </div>
                        <div className={styles.additionalSGDescription}>
                            <DsTypography variant="Regular_14" className={styles.descriptionText}>
                                {t('databases.general.security-group-description-header')}
                            </DsTypography>
                            <DsTypography variant="Regular_14" className={styles.descriptionText}>
                                {t('databases.general.security-group-description-body')}
                            </DsTypography>
                        </div>
                        <div className={styles.handleSelect}>
                            <div className={styles.selectLabelWrapper}>
                                <DsTypography
                                    variant="Regular_14"
                                    className={
                                        !isAdditionalSGEnabled ? CommonStyles['text-disabled'] : styles.selectLabel
                                    }
                                >
                                    {t('databases.general.existing-security-group')}
                                </DsTypography>
                            </div>
                            <DsSelect
                                isLoading={sgLoading}
                                isDisabled={!isAdditionalSGEnabled}
                                title=""
                                placeholder={t('databases.general.select-additional-security-groups')}
                                formatLabel={labelForSGSelect}
                                selectedOptionIds={pendingSelectedIds}
                                // @ts-ignore
                                options={sgOptionsWithDisabled}
                                selectionType="multi"
                                isWithActions
                                onSelect={(options: any) => {
                                    const committed = (options ?? []).slice(0, MAX_SG_SELECTION);
                                    dispatch(setSelectedExistingSecurityGroup(committed));
                                    dispatch(setIsWizardTouched(true));
                                }}
                                onExpandChange={(isExpanded: boolean) => {
                                    if (!isExpanded) {
                                        setPendingSelectedIds(committedIds);
                                    }
                                }}
                                dropDown={{
                                    isCloseOnClickOutside: true
                                }}
                                searchMethod={generateExistingSecurity.length > 5 ? { method: 'basic' } : undefined}
                                isCleanable={false}
                                className={styles.changeColor}
                            />
                        </div>
                    </DsTypography>
                </AccordionCardContent>
            </AccordionCard>
        </div>
    );
};
export default SecurityGroup;
