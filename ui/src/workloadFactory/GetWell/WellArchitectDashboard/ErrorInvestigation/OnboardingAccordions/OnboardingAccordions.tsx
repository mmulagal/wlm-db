import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as Bedrock } from '../../../../../assets/Bedrock.svg';
import { ReactComponent as Networking } from '../../../../../assets/networking.svg';
import { ReactComponent as EC2Instance } from '../../../../../assets/ec2-instance.svg';
import { ReactComponent as CredentialAssociated } from '../../../../../assets/credential-associated.svg';
import { ReactComponent as BedrockDisabled } from '../../../../../assets/Bedrock-disabled.svg';
import { ReactComponent as NetworkingDisabled } from '../../../../../assets/networking-disabled.svg';
import { ReactComponent as EC2InstanceDisabled } from '../../../../../assets/ec2-instance-disabled.svg';
import { ReactComponent as CredentialAssociatedDisabled } from '../../../../../assets/credential-associated-disabled.svg';
import {
    AccordionItem,
    ManageInstanceAccordion
} from '../../../../InventoryV2/InventoryTablesComponent/ManageInstanceWizard/ManageInstanceStep/ManageInstanceAccordion/ManageInstanceAccordion';
import { PermissionContent } from '../../../../InventoryV2/InventoryTablesComponent/ManageInstanceWizard/ManageInstanceStep/PermissionListComponent/PermissionContent/PermissionContent';
import styles from './OnboardingAccordions.module.scss';

const OnboardingAccordions = () => {
    const { t } = useTranslation();
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [disableAll] = useState(false);
    const isDisabled = false;

    const items: AccordionItem[] = [
        {
            id: '1',
            title: t('databases.log-analyzer.amazon-bedrock'),
            subtitle: t('databases.log-analyzer.prerequisites'),
            readinessStatus: t('databases.log-analyzer.readiness-status'),
            missingPermission: false,
            image: isDisabled ? <BedrockDisabled /> : <Bedrock />,
            content: (
                <PermissionContent
                    title={t('databases.log-analyzer.prerequisites-list')}
                    infoBlock={t('databases.log-analyzer.accordion-1-info')}
                    blocks={[
                        {
                            label: t('databases.log-analyzer.bedrock-model-activation'),
                            values: [t('databases.log-analyzer.bedrock-model-activation-content')],
                            showCopy: false,
                            viewPolicy: {
                                value: false,
                                withTabs: false
                            }
                        }
                    ]}
                    policies={{}}
                />
            )
        },
        {
            id: '2',
            title: t('databases.log-analyzer.onboarding-accordion-2-title'),
            subtitle: t('databases.log-analyzer.prerequisites'),
            readinessStatus: t('databases.log-analyzer.readiness-status'),
            missingPermission: false,
            image: isDisabled ? <NetworkingDisabled /> : <Networking />,
            content: (
                <PermissionContent
                    title={t('databases.log-analyzer.prerequisites-list')}
                    infoBlock={t('databases.log-analyzer.onboarding-accordion-2-info')}
                    blocks={[
                        {
                            label: t('databases.log-analyzer.onboarding-accordion-2-label'),
                            values: [t('databases.log-analyzer.onboarding-accordion-2-value-1')],
                            showCopy: false,
                            viewPolicy: {
                                value: false,
                                withTabs: false
                            }
                        },
                        {
                            label: t('databases.log-analyzer.onboarding-accordion-2-label'),
                            values: [t('databases.log-analyzer.onboarding-accordion-2-value-2')],
                            showCopy: false,
                            viewPolicy: {
                                value: false,
                                withTabs: false
                            }
                        }
                    ]}
                    policies={{}}
                />
            )
        },
        {
            id: '3',
            title: t('databases.log-analyzer.onboarding-accordion-3-title'),
            subtitle: t('databases.log-analyzer.prerequisites'),
            readinessStatus: t('databases.log-analyzer.readiness-status'),
            missingPermission: false,
            image: isDisabled ? <EC2InstanceDisabled /> : <EC2Instance />,
            content: (
                <PermissionContent
                    title={t('databases.log-analyzer.prerequisites-list')}
                    infoBlock={t('databases.log-analyzer.onboarding-accordion-3-info')}
                    blocks={[
                        {
                            label: t('databases.log-analyzer.onboarding-accordion-3-label'),
                            values: [t('databases.log-analyzer.onboarding-accordion-3-value-1')],
                            showCopy: false,
                            viewPolicy: {
                                value: false,
                                withTabs: false
                            }
                        }
                    ]}
                    policies={{}}
                />
            )
        },
        {
            id: '4',
            title: t('databases.log-analyzer.onboarding-accordion-4-title'),
            subtitle: t('databases.log-analyzer.prerequisites'),
            readinessStatus: t('databases.log-analyzer.readiness-status'),
            missingPermission: false,
            image: isDisabled ? <CredentialAssociatedDisabled /> : <CredentialAssociated />,
            content: (
                <PermissionContent
                    title={t('databases.log-analyzer.prerequisites-list')}
                    infoBlock={t('databases.log-analyzer.onboarding-accordion-4-info')}
                    blocks={[
                        {
                            label: t('databases.log-analyzer.onboarding-accordion-4-label'),
                            values: [t('databases.log-analyzer.onboarding-accordion-4-value-1')],
                            showCopy: false,
                            viewPolicy: {
                                value: false,
                                withTabs: false
                            }
                        }
                    ]}
                    policies={{}}
                />
            )
        }
    ];
    return (
        <div className={styles.onboardingAccordions}>
            <div className={styles.accordionSection}>
                <ManageInstanceAccordion
                    items={items}
                    expandedId={expandedId}
                    setExpandedId={setExpandedId}
                    disableAll={disableAll}
                />
            </div>
        </div>
    );
};

export default OnboardingAccordions;
