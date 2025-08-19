import { useTranslation } from 'react-i18next';
import { DsSelect, DsTypography } from '@tlveng/wlm-ds';
import { Button, useDialog } from '@netapp/design-system';
import { useEffect, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import styles from './ProtectionDialogs.module.scss';
import { ReactComponent as Bullet } from '../../../../assets/ic_bullet.svg';
import { ReactComponent as Complete } from '../../../../assets/complete-tick.svg';

import {
    AccordionCard,
    AccordionCardContent,
    AccordionController
} from '../../../../common/AccordionCard/AccordionCard';
import { useAppSelector } from '../../../../store/storeHooks';
import DialogComponent from '../../../../common/Dialog/DialogComponent';
import { bxpRedirect } from '../../../../utils/utilityFunctions';
import StepTwoDialog from './StepTwoDialog';
import SeparatorComponent from '../../../../common/SeparatorComponent/SeparatorComponent';
import { resetProtectionProcess, setSelectedAgent } from '../../../../store/workloadFactory/snapcenterSlice';
import { SNAPCENTER_STATUS } from '../../../../utils/consts';

const SingleAgentDialog = ({ agents, hostExists, dialogKey, dialogType, extraStep }: any) => {
    const { t } = useTranslation();

    const { setDialog, closeDialog } = useDialog();
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const { selectedAgent } = useAppSelector(state => state.snapCenter);
    const dispatch = useDispatch();

    const isMultiConnector = agents && agents.length > 1;

    const protectionState = useAppSelector(state => state.snapCenter.protectionProcessState[dialogKey]);

    useEffect(() => {
        if (!protectionState) {
            dispatch(resetProtectionProcess(dialogKey));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialogKey, dispatch]);

    useEffect(() => {
        if (protectionState?.step2Status === 'done') {
            setTimeout(() => {
                setDialog(
                    <DialogComponent
                        header={
                            <div
                                className={styles.headerClass}
                                style={{ display: 'flex', justifyContent: 'space-between' }}
                            >
                                <DsTypography variant="Regular_14">
                                    {dialogType === 'database'
                                        ? t('databases.inventory.protect-header-database')
                                        : t('databases.inventory.protect-header')}
                                </DsTypography>
                                <DsTypography variant="Regular_14" className={styles.protectionHeaderText}>
                                    {extraStep
                                        ? t('databases.inventory.step-3-out-of')
                                        : t('databases.inventory.step-2-out-of')}
                                </DsTypography>
                            </div>
                        }
                        content={<StepTwoDialog />}
                        primaryButton={t('databases.inventory.redirect')}
                        secondaryButton={t('databases.inventory.cancel')}
                        closeCallback={() => {
                            closeDialog();
                        }}
                        callback={() => {
                            bxpRedirect(isWorkloadFactory);
                        }}
                    />
                );
            }, 0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [protectionState?.step2Status, dialogKey, dispatch]);

    // map to dropdown format
    const generateDropDownValues = useMemo(
        () =>
            agents.map((item: { agent: any }) => {
                const { agent } = item;
                return {
                    id: agent.agentId,
                    label: `${agent.name}, ${agent.status}, ${agent.region}`,
                    value: agent.name
                };
            }),
        [agents]
    );

    useEffect(() => {
        if (generateDropDownValues && generateDropDownValues.length > 0) {
            // If no agent is selected, set the first agent as selected
            if (!selectedAgent || selectedAgent.length === 0) {
                dispatch(setSelectedAgent([generateDropDownValues[0]]));
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [agents, generateDropDownValues]);

    const labelForDropDown = () => {
        if (selectedAgent && selectedAgent.length > 0) {
            return selectedAgent[0].value;
        }
        return '';
    };

    const learnMore = () => {
        window.open(
            'https://docs.netapp.com/us-en/snapcenter/protect-scsql/concept_snapcenter_plug_in_for_microsoft_sql_server_overview.html',
            '_blank',
            'noopener,noreferrer'
        );
    };
    return (
        <div className={styles.protectionDialogsAgent}>
            {isMultiConnector && (
                <div className={styles.multiAgent}>
                    <DsTypography variant="Regular_14">{t('databases.inventory.multi-agent-text')}</DsTypography>

                    <DsSelect
                        title={t('databases.inventory.agent')}
                        formatLabel={() => labelForDropDown()}
                        className={styles.selectBox}
                        // @ts-ignore
                        options={generateDropDownValues}
                        selectionType="single"
                        onSelect={(option: any) => {
                            dispatch(setSelectedAgent(option));
                        }}
                        formatOptionLabel={(option: any) => {
                            const value = option.label.split(', ');
                            return (
                                <div className={styles.optionLabel}>
                                    <DsTypography variant="Semibold_14" className={styles.optionText}>
                                        {value[0]}
                                    </DsTypography>
                                    <div className={styles.row}>
                                        <div className={styles.status}>
                                            {value[1].toLowerCase() === SNAPCENTER_STATUS.ACTIVE && (
                                                <div
                                                    className={`${styles.statusIcon} ${styles.circle} ${styles.online}`}
                                                />
                                            )}
                                            {value[1].toLowerCase() === SNAPCENTER_STATUS.INACTIVE && (
                                                <div
                                                    className={`${styles.statusIcon} ${styles.circle} ${styles.offline}`}
                                                />
                                            )}
                                            <DsTypography variant="Regular_14" className={styles.optionText}>
                                                {value[1].charAt(0).toUpperCase() + value[1].slice(1).toLowerCase()}
                                            </DsTypography>
                                        </div>

                                        <SeparatorComponent variant="vertical" height="13px" />
                                        <DsTypography variant="Regular_14" className={styles.optionText}>
                                            {value[2]}
                                        </DsTypography>
                                        {/* <SeparatorComponent variant="vertical" height="13px" />
                                        <DsTypography variant="Regular_14" className={styles.optionText}>
                                            {value[3]}
                                        </DsTypography> */}
                                    </div>
                                </div>
                            );
                        }}
                        isCleanable={false}
                        dropDown={{
                            isCloseOnClickOutside: true
                        }}
                        searchMethod={{
                            method: 'smart'
                        }}
                        isDisabled={false}
                    />
                </div>
            )}
            <div className={styles.topSection}>
                <DsTypography variant="Semibold_14">
                    {dialogType === 'database'
                        ? t('databases.inventory.protection-steps-text-database')
                        : t('databases.inventory.protection-steps-text')}
                </DsTypography>
                <div className={styles.item}>
                    <div className={styles.row}>
                        <Bullet />
                        <DsTypography variant="Regular_14" className={styles.text}>
                            {t('databases.inventory.protection-step-one')}
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <Bullet />
                        <DsTypography variant="Regular_14" className={styles.text}>
                            {t('databases.inventory.protection-step-two')}
                        </DsTypography>
                    </div>

                    <div className={styles.row}>
                        <Bullet />
                        <DsTypography className={styles.text} variant="Regular_14">
                            {t('databases.inventory.protection-step-three')}
                        </DsTypography>
                    </div>
                </div>
            </div>

            <DsTypography variant="Semibold_14" className={styles.heading}>
                {t('databases.inventory.prepare-data-text')}
            </DsTypography>

            <div className={styles.accordionSectionProtect}>
                <AccordionController isGrouped>
                    <div className={styles.firstAccordion}>
                        <AccordionCard
                            id="1"
                            title={
                                <div className={styles.titleClass}>
                                    {protectionState?.step1Status === 'running' && !hostExists ? (
                                        <div className={styles['loader-container']}>
                                            <div className={styles.spinner}>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="40"
                                                    height="40"
                                                    viewBox="0 0 40 40"
                                                    fill="none"
                                                >
                                                    <path
                                                        d="M1.60001 20C0.716352 20 -0.00664733 20.7175 0.0639626 21.5984C0.335916 24.9907 1.47011 28.2671 3.37061 31.1114C5.56824 34.4004 8.69181 36.9638 12.3463 38.4776C16.0009 39.9913 20.0222 40.3874 23.9018 39.6157C27.7814 38.844 31.3451 36.9392 34.1421 34.1421C36.9392 31.3451 38.844 27.7814 39.6157 23.9018C40.3874 20.0222 39.9913 16.0009 38.4776 12.3463C36.9638 8.69181 34.4004 5.56824 31.1114 3.37061C28.2671 1.47011 24.9907 0.335913 21.5984 0.0639594C20.7175 -0.0066507 20 0.716349 20 1.6C20 2.48366 20.718 3.1921 21.5976 3.27613C24.3562 3.53964 27.0157 4.48256 29.3336 6.03131C32.0963 7.87732 34.2496 10.5011 35.5212 13.5709C36.7927 16.6407 37.1254 20.0186 36.4772 23.2775C35.829 26.5364 34.2289 29.5299 31.8794 31.8794C29.5299 34.2289 26.5364 35.829 23.2775 36.4772C20.0186 37.1254 16.6407 36.7927 13.5709 35.5212C10.5011 34.2496 7.87732 32.0963 6.03132 29.3336C4.48256 27.0157 3.53964 24.3562 3.27613 21.5976C3.1921 20.718 2.48366 20 1.60001 20Z"
                                                        fill="#0067C5"
                                                    />
                                                </svg>
                                            </div>
                                            <div className={styles['center-circle']}>1</div>
                                        </div>
                                    ) : protectionState?.step1Status === 'done' || hostExists ? (
                                        <div className={styles.circleClass}>
                                            <Complete />
                                        </div>
                                    ) : (
                                        <div className={styles.circleClass}>1</div>
                                    )}

                                    <DsTypography variant="Semibold_14">
                                        {t('databases.inventory.auto-host-registration')}
                                    </DsTypography>
                                </div>
                            }
                        >
                            <AccordionCardContent>
                                <DsTypography variant="Regular_14">
                                    {t('databases.inventory.auto-host-registration-text')}
                                </DsTypography>
                            </AccordionCardContent>
                        </AccordionCard>
                    </div>

                    <div className={styles.secondAccordion}>
                        <AccordionCard
                            id="2"
                            title={
                                <div className={styles.titleClass}>
                                    {protectionState?.step2Status === 'running' && !hostExists ? (
                                        <div className={styles['loader-container']}>
                                            <div className={styles.spinner}>
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    width="40"
                                                    height="40"
                                                    viewBox="0 0 40 40"
                                                    fill="none"
                                                >
                                                    <path
                                                        d="M1.60001 20C0.716352 20 -0.00664733 20.7175 0.0639626 21.5984C0.335916 24.9907 1.47011 28.2671 3.37061 31.1114C5.56824 34.4004 8.69181 36.9638 12.3463 38.4776C16.0009 39.9913 20.0222 40.3874 23.9018 39.6157C27.7814 38.844 31.3451 36.9392 34.1421 34.1421C36.9392 31.3451 38.844 27.7814 39.6157 23.9018C40.3874 20.0222 39.9913 16.0009 38.4776 12.3463C36.9638 8.69181 34.4004 5.56824 31.1114 3.37061C28.2671 1.47011 24.9907 0.335913 21.5984 0.0639594C20.7175 -0.0066507 20 0.716349 20 1.6C20 2.48366 20.718 3.1921 21.5976 3.27613C24.3562 3.53964 27.0157 4.48256 29.3336 6.03131C32.0963 7.87732 34.2496 10.5011 35.5212 13.5709C36.7927 16.6407 37.1254 20.0186 36.4772 23.2775C35.829 26.5364 34.2289 29.5299 31.8794 31.8794C29.5299 34.2289 26.5364 35.829 23.2775 36.4772C20.0186 37.1254 16.6407 36.7927 13.5709 35.5212C10.5011 34.2496 7.87732 32.0963 6.03132 29.3336C4.48256 27.0157 3.53964 24.3562 3.27613 21.5976C3.1921 20.718 2.48366 20 1.60001 20Z"
                                                        fill="#0067C5"
                                                    />
                                                </svg>
                                            </div>
                                            <div className={styles['center-circle']}>2</div>
                                        </div>
                                    ) : protectionState?.step2Status === 'done' || hostExists ? (
                                        <div className={styles.circleClass}>
                                            <Complete />
                                        </div>
                                    ) : (
                                        <div className={styles.circleClass}>2</div>
                                    )}

                                    <DsTypography variant="Semibold_14">
                                        {t('databases.inventory.plug-in-installation')}
                                    </DsTypography>
                                </div>
                            }
                        >
                            <AccordionCardContent>
                                <DsTypography variant="Regular_14">
                                    {t('databases.inventory.plug-in-installation-text')}
                                </DsTypography>
                                <Button className={styles.buttonClass} onClick={learnMore} variant="link">
                                    {t('databases.inventory.button-text')}
                                </Button>
                            </AccordionCardContent>
                        </AccordionCard>
                    </div>
                </AccordionController>
            </div>
        </div>
    );
};

export default SingleAgentDialog;
