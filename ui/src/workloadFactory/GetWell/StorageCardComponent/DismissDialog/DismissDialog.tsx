import { useTranslation } from 'react-i18next';
import { DsRadioButton, DsTypography } from '@tlveng/wlm-ds';
import { useState } from 'react';
import { TFunction } from 'i18next';
import { ASSESSMENT_CONFIG_NAMES, CONFIG_STATE_ACTIONS } from '../../../../utils/consts';
import styles from './DismissDialog.module.scss';
import DialogComponent from '../../../../common/Dialog/DialogComponent';

interface DismissDialogProps {
    type: string;
    storageTier?: string;
    isSubConfiguration?: boolean;
    subConfigurationName?: string;
    subConfigurationCount?: number;
    callback: (dismissOption: string) => void;
    closeCallback: () => void;
}

export const DismissDialog = ({
    type,
    storageTier,
    isSubConfiguration,
    subConfigurationName,
    subConfigurationCount,
    callback,
    closeCallback
}: DismissDialogProps) => {
    const { t } = useTranslation();
    const [selectedOption, setSelectedOption] = useState<string>(CONFIG_STATE_ACTIONS.DISMISS);

    const handleOptionSelect = (option: string) => {
        setSelectedOption(option);
    };

    return (
        <DialogComponent
            header={t('databases.well-architect.dismiss.header')}
            content={
                <DismissDialogOptions
                    type={type}
                    storageTier={storageTier}
                    isSubConfiguration={isSubConfiguration}
                    subConfigurationName={subConfigurationName}
                    subConfigurationCount={subConfigurationCount}
                    selectedOption={selectedOption}
                    onOptionChange={handleOptionSelect}
                    translation={t}
                />
            }
            primaryButton={t('databases.well-architect.dismiss.primaryButton')}
            secondaryButton={t('databases.well-architect.dismiss.secondaryButton')}
            callback={() => {
                callback(selectedOption);
            }}
            closeCallback={closeCallback}
        />
    );
};

interface DismissDialogOptionsProps {
    type: string;
    storageTier?: string;
    isSubConfiguration?: boolean;
    subConfigurationName?: string;
    subConfigurationCount?: number;
    selectedOption: string;
    onOptionChange: (option: string) => void;
    translation: TFunction;
}

enum DismissOption {
    DISMISS = 'DISMISSED',
    POSTPONE = 'POSTPONED'
}

const DismissDialogOptions = ({
    type,
    storageTier,
    isSubConfiguration,
    subConfigurationName,
    subConfigurationCount,
    selectedOption,
    onOptionChange,
    translation
}: DismissDialogOptionsProps) => {
    const handleOptionChange = (option: DismissOption) => {
        onOptionChange(option);
    };

    // Generate the message based on configuration type
    const generateMessage = () => {
        const configName = storageTier || type;

        if (isSubConfiguration && subConfigurationName) {
            // For sub-configurations inside ONTAP, OS and MTU
            return (
                <>
                    {translation('databases.well-architect.dismiss.dialog-message-content1')}{' '}
                    <span style={{ fontWeight: '500' }}>{subConfigurationName}</span>{' '}
                    {translation('databases.well-architect.dismiss.dialog-message-subConfiguration')}
                </>
            );
        }
        if (
            (configName === ASSESSMENT_CONFIG_NAMES.ONTAP_CAPS ||
                configName === ASSESSMENT_CONFIG_NAMES.OPERATING_SYSTEM ||
                configName === ASSESSMENT_CONFIG_NAMES.MSSQL_HIGH_AVAILABILITY) &&
            subConfigurationCount
        ) {
            // For ONTAP/OS/MSSQL_HIGH_AVAILABILITY with sub-configurations
            return (
                <>
                    {translation('databases.well-architect.dismiss.dialog-message-content1')}{' '}
                    <span style={{ fontWeight: '500' }}>{configName}</span>{' '}
                    {translation('databases.well-architect.dismiss.dialog-message-configuration')}{' '}
                    <span style={{ fontWeight: '500' }}>{configName}</span>{' '}
                    {translation('databases.well-architect.dismiss.dialog-message-content2')} {subConfigurationCount}{' '}
                    {translation('databases.well-architect.dismiss.dialog-message-subConfiguration')}
                </>
            );
        }
        // For regular configurations
        return (
            <>
                {translation('databases.well-architect.dismiss.dialog-message-content1')}{' '}
                <span style={{ fontWeight: '500' }}>{configName}</span>{' '}
                {translation('databases.well-architect.dismiss.dialog-message-configuration')}
            </>
        );
    };

    return (
        <div className={styles.dismissDialog}>
            <DsTypography className={styles.dismissMessage} variant="Regular_14">
                {generateMessage()}
            </DsTypography>

            <div className={styles.radioContainer}>
                <DsRadioButton
                    id="dismiss-option"
                    data-testid="wlm-db-dismiss-option"
                    variant="Default"
                    title={translation('databases.well-architect.dismiss.dismiss-option')}
                    isSelected={selectedOption === DismissOption.DISMISS}
                    onClick={() => handleOptionChange(DismissOption.DISMISS)}
                />
                <DsRadioButton
                    id="postpone-option"
                    data-testid="wlm-db-postpone-option"
                    variant="Default"
                    title={translation('databases.well-architect.dismiss.postpone-option')}
                    isSelected={selectedOption === DismissOption.POSTPONE}
                    onClick={() => handleOptionChange(DismissOption.POSTPONE)}
                />
            </div>

            <DsTypography variant="Regular_14">{translation('databases.well-architect.dismiss.footer')}</DsTypography>
        </div>
    );
};
