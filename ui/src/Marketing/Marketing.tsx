import { BlueXPListeners, DsButton, DsTypography, postBlueXPMessage } from '@netapp/design-system';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as KB } from '../assets/DS - KB illustration.svg';
import { ReactComponent as Unflattened } from '../assets/un-flattened 2.svg';
import { ReactComponent as UnflattenedLarge } from '../assets/un-flattened-enlarge.svg';
import { ReactComponent as Expand } from '../assets/ic_expand.svg';
import { ReactComponent as Close } from '../assets/ic_close.svg';
import { ReactComponent as Tick } from '../assets/tick-icon.svg';
import { ReactComponent as Dollar } from '../assets/dollar.svg';
import { ReactComponent as Rocket } from '../assets/rocket.svg';
import { ReactComponent as Thunder } from '../assets/thunder.svg';
import { ReactComponent as Setting } from '../assets/settings.svg';
import styles from './Marketing.module.scss';
import CardComponent from './CardComponent/CardComponent';
import { WLF_TO_FORM_NAVIGATE, WLF_TO_PROTECT_NAVIGATE,FORM_TO_WLF_NAVIGATE_INVENTORY } from '../utils/consts';
import { useAppSelector } from '../store/storeHooks';

const Marketing = () => {
    const navigate = useNavigate();
    const { isWorkloadFactory } = useAppSelector(state => state?.auth);
    const [isModalOpen, setModalOpen] = useState(false);
    const handleOpenModal = () => {
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
    };

    const handleNavigation = () => {
        if (isWorkloadFactory) {
            navigate(WLF_TO_FORM_NAVIGATE);
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: './mssql-deploy-wizard',
                    replace: true
                }
            });
        } else {
            navigate('../../fsxdb/mssql-deploy-wizard');
            postBlueXPMessage({
                type: BlueXPListeners.navigate,
                payload: {
                    pathname: '../../fsxdb/mssql-deploy-wizard',
                    replace: true
                }
            });
        }
    };

    return (
        <>
            <div className={styles.marketing}>
                <DsTypography variant="Regular_20" className={styles.header}>
                    Databases
                </DsTypography>

                <div className={styles.section2}>
                    <div className={styles.section2LeftSde}>
                        <DsTypography variant="Regular_40" style={{ lineHeight: 'unset', whiteSpace: 'nowrap' }}>
                            Workload Factory for databases on AWS 
                        </DsTypography>

                        <div className={styles.textSection}>
                            <DsTypography variant="Regular_16">
                                Workload Factory helps assess, plan, provision, and move database workloads to FSx for
                                ONTAP, while adhering to industry best practices optimized to meet your desired
                                performance and cost. It provides centralized operations and monitoring of your database
                                workflows, and integrates into your existing operational workflow through automatically
                                created infrastructure-as-code snippets. This helps you save you significant effort,
                                time, and costs in configuring and operating your database workloads. 
                            </DsTypography>
                        </div>

                        <div className={styles.buttonSection}>
                            <DsButton
                                variant="Default"
                                dropDown={{
                                    trigger: 'click',
                                    autoPosition: true,
                                    items: [
                                        {
                                            id: 'wlm-db-deploy-mssql-host',
                                            label: 'Microsoft SQL Server',
                                            onClick: () => {
                                                if (isWorkloadFactory) {
                                                    navigate(WLF_TO_FORM_NAVIGATE);
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: {
                                                            pathname: './mssql-deploy-wizard',
                                                            replace: true
                                                        }
                                                    });
                                                } else {
                                                    navigate('../../fsxdb/mssql-deploy-wizard');
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: {
                                                            pathname: '../../fsxdb/mssql-deploy-wizard',
                                                            replace: true
                                                        }
                                                    });
                                                }
                                            },
                                            className: 'mssql-deployment-button'
                                        },
                                        {
                                            id: 'wlm-db-deploy-pgsql-host',
                                            label: 'PostgreSQL Server',
                                            onClick: () => {
                                                if (isWorkloadFactory) {
                                                    navigate(WLF_TO_PROTECT_NAVIGATE);
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: {
                                                            pathname: './postgreSQL-deploy-wizard',
                                                            replace: true
                                                        }
                                                    });
                                                } else {
                                                    navigate('../../fsxdb/postgreSQL-deploy-wizard');
                                                    postBlueXPMessage({
                                                        type: BlueXPListeners.navigate,
                                                        payload: {
                                                            pathname: '../../fsxdb/postgreSQL-deploy-wizard',
                                                            replace: true
                                                        }
                                                    });
                                                }
                                            },
                                            className: 'pgsql-deployment-button'
                                        }
                                    ]
                                }}
                             >
                                Get Started
                            </DsButton>
                            <DsButton
                                variant="secondary"
                                onClick={() => {
                                    // Always navigate to inventory, regardless of credentials
                                    if (isWorkloadFactory) {
                                        navigate(FORM_TO_WLF_NAVIGATE_INVENTORY,{ state: { allowDashboardNoCred: true } });
                                        postBlueXPMessage({
                                            type: BlueXPListeners.navigate,
                                            payload: {
                                                pathname: './databases/inventory',
                                                replace: true
                                            }
                                        });
                                    } else {
                                        navigate('../../fsxdb/inventory', { state: { allowDashboardNoCred: true } });
                                        postBlueXPMessage({
                                            type: BlueXPListeners.navigate,
                                            payload: {
                                                pathname: '../../fsxdb/inventory',
                                                replace: true
                                            }
                                        });
                                    }
                                }}
                            >
                                Discover
                            </DsButton>
                        </div>
                    </div>

                    <div className={styles.section2RightSde}>
                        <div>
                            <Unflattened />
                        </div>
                        <div
                            className={styles.arrowStyle}
                            onClick={handleOpenModal}
                            role="button"
                            tabIndex={0}
                            aria-label="Expand illustration"
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') handleOpenModal();
                            }}
                        >
                            <Expand />
                        </div>
                    </div>
                </div>

                <div className={styles.section3}>
                    <div className={styles.topSection}>
                        <KB />
                        <div />
                    </div>
                    <div className={styles.textSection}>
                        <DsTypography variant="Semibold_24" className={styles.title}>
                            Workload Factory: Self-managed database automation and operations with FSx for ONTAP
                        </DsTypography>
                        <div />
                    </div>

                    <div className={styles.bottomSection}>
                        <div className={styles.commonSection}>
                            <div className={styles.cardSection}>
                                <div className={styles.cardHeading}>
                                    <Tick />
                                    <DsTypography variant="Semibold_16" style={{ lineHeight: 'unset' }}>
                                        Plan your migration and save costs
                                    </DsTypography>
                                </div>
                                <DsTypography variant="Regular_14">
                                    Detect existing AWS database deployments or deploy new ones, while assessing
                                    availability, protection, capacity, performance, and potential cost savings by
                                    utilizing FSx for ONTAP as data storage infrastructure.
                                </DsTypography>
                            </div>

                            <div className={styles.cardSection}>
                                <div className={styles.cardHeading}>
                                    <Tick />
                                    <DsTypography variant="Semibold_16" style={{ lineHeight: 'unset' }}>
                                        Automate best practices 
                                    </DsTypography>
                                </div>
                                <DsTypography variant="Regular_14">
                                    Create automatic end-to-end database deployments with implemented AWS, Microsoft and
                                    ONTAP best practices through a GUI or via auto-generated infrastructure-as-code
                                    snippets. 
                                </DsTypography>
                            </div>
                        </div>
                        <div className={styles.commonSection}>
                            <div className={styles.cardSection}>
                                <div className={styles.cardHeading}>
                                    <Tick />
                                    <DsTypography variant="Semibold_16" style={{ lineHeight: 'unset' }}>
                                        Operate and optimize
                                    </DsTypography>
                                </div>
                                <DsTypography variant="Regular_14">
                                    Use a visual inventory to get full visibility into your deployment and continuously
                                    optimize it by identifying deviations from best practices and automatically aligning
                                    them.
                                </DsTypography>
                            </div>

                            <div className={styles.cardSection}>
                                <div className={styles.cardHeading}>
                                    <Tick />
                                    <DsTypography variant="Semibold_16" style={{ lineHeight: 'unset' }}>
                                        Test-drive your databases
                                    </DsTypography>
                                </div>
                                <DsTypography variant="Regular_14">
                                    Use the Sandbox, a database environment isolated from your production, for testing
                                    purposes, diagnostics, training and for DB refreshes.
                                </DsTypography>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={styles.section4}>
                    <div className={styles.textSection}>
                        <DsTypography variant="Semibold_24" style={{ lineHeight: 'unset' }}>
                            FSx for ONTAP: intelligent storage for your database workloads
                        </DsTypography>
                        <div />
                    </div>
                    <div className={styles.cards}>
                        <div className={styles.commonRow}>
                            <CardComponent
                                image={<Dollar />}
                                title="Reduced costs by up to 50%"
                                desc="FSx for ONTAP cuts database costs by up to 50% with thin clones, storage efficiencies, and optimized Snapshots. Use fewer EC2 instances, lowering compute and database expenses."
                            />
                            <CardComponent
                                image={<Thunder />}
                                title="Enhanced database protection"
                                desc="FSx for ONTAP provides instant database restoration with lightweight Snapshots. Achieve up to 1-minute RPO and minimal RTO with built-in cross-region replication for disaster recovery."
                            />
                        </div>

                        <div className={styles.commonRow}>
                            <CardComponent
                                image={<Rocket />}
                                title="Instant database creation and refresh"
                                desc="Create and refresh dev/test and staging database environments instantly, reducing costs and accelerating time to market. Thin cloning technology minimizes additional capacity and costs."
                            />
                            <CardComponent
                                image={<Setting />}
                                title="Maintain low latencies and high availability "
                                desc="Enjoy high performance with millions of IOPS, and high throughput. Boost performance for frequently accessed data even further with unique in-memory and NVMe caching."
                            />
                        </div>
                    </div>
                </div>
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={handleCloseModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <UnflattenedLarge />
                        <div className={styles.closeButton} onClick={handleCloseModal}>
                            <Close />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Marketing;
