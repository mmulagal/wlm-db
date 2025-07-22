import { useState } from 'react';
import { ReactComponent as ReviewDisabled } from '../../../../..//assets/Review-disabled.svg';
import {
    AccordionItem,
    ManageInstanceAccordion
} from '../../../../InventoryV2/InventoryTablesComponent/ManageInstanceWizard/ManageInstanceStep/ManageInstanceAccordion/ManageInstanceAccordion';
import { PermissionContent } from '../../../../InventoryV2/InventoryTablesComponent/ManageInstanceWizard/ManageInstanceStep/PermissionListComponent/PermissionContent/PermissionContent';
import styles from './OnboardingAccordions.module.scss';

const OnboardingAccordions = () => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [disableAll] = useState(false);

    const items: AccordionItem[] = [
        {
            id: '1',
            title: 'Amazon Bedrock',
            subtitle: 'Capability',
            readinessStatus: 'Ready',
            missingPermission: false,
            image: <ReviewDisabled />,
            content: (
                <PermissionContent
                    title={'Prerequisites list'}
                    blocks={[
                        {
                            label: 'Bedrock model activation',
                            values: [
                                'Bedrock model anthropic.claude-sonnet-4-20250514 should be enabled in the AWS account and accessible from the region where SQL node is hosted.'
                            ],
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
