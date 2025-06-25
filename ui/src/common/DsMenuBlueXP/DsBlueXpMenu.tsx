import { ReactComponent as MenuIcon } from '@netapp/icons/ic_menu.svg';
import { ReactComponent as ExternalLinkIcon } from '@netapp/icons/ic_external_link.svg';

import { BlueXPListeners, DsButton, DsTypography, postBlueXPMessage } from '@netapp/design-system';
import styles from './DsBlueXpMenu.module.scss';

export interface DsBlueXpMenuProps {
    id?: string;
    'data-testid'?: string;
    domain: string;
    className?: string;
}

// DsMenu

export const DsBlueXpMenu = ({ domain, className, ...rest }: DsBlueXpMenuProps) => {
    enum MenuItems {
        links = 'links',
        notifications = 'notifications',
        credentials = 'credentials',
        hub = 'hub',
        gitRepo = 'gitRepo',
        rss = 'rss'
    }

    const navigateTo = (path: string) => {
        postBlueXPMessage({
            type: BlueXPListeners.navigate,
            payload: {
                pathname: path,
                replace: true
            }
        });
    };

    return (
        <DsButton
            className={styles.dsHamburgerMenu}
            type="icon"
            icon={<MenuIcon />}
            dropDown={{
                placement: 'alignRight',
                maxHeight: `${68 * 5}px`,
                formatOptionLabel: option => {
                    switch (option.id as MenuItems) {
                        case MenuItems.links:
                            return (
                                <DsTypography
                                    variant="Semibold_13"
                                    className={styles.blueMenuItem}
                                    onClick={() => navigateTo('/fsxhome/links')}
                                >
                                    Links
                                </DsTypography>
                            );
                        case MenuItems.notifications:
                            return (
                                <DsTypography
                                    variant="Semibold_13"
                                    className={styles.blueMenuItem}
                                    onClick={() => navigateTo('/fsxhome/notification-setup')}
                                >
                                    Workload factory notification setup
                                </DsTypography>
                            );
                        case MenuItems.hub:
                            return (
                                <a
                                    href={`https://${domain}/api-doc`}
                                    className={styles.blueMenuItem}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <DsTypography variant="Semibold_13" className={styles.extenalLink}>
                                        API Hub
                                        <ExternalLinkIcon />
                                    </DsTypography>
                                </a>
                            );
                        case MenuItems.gitRepo:
                            return (
                                <a
                                    href="https://github.com/NetApp/FSx-ONTAP-samples-scripts/tree/main/Monitoring"
                                    className={styles.blueMenuItem}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <DsTypography variant="Semibold_13" className={styles.extenalLink}>
                                        Monitoring GitHub repository
                                        <ExternalLinkIcon />
                                    </DsTypography>
                                </a>
                            );
                        case MenuItems.rss:
                            return (
                                <a
                                    href="https://docs.netapp.com/us-en/workload-relnotes/feed.xml"
                                    className={styles.blueMenuItem}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    <DsTypography variant="Semibold_13" className={styles.extenalLink}>
                                        Subscribe to RSS
                                        <svg
                                            width="16"
                                            height="16"
                                            viewBox="0 0 16 16"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            className="rssIcon"
                                        >
                                            <path
                                                d="M5.2743 12.3957C5.2743 13.276 4.56413 13.9898 3.68737 13.9898C2.81138 13.9898 2.10084 13.276 2.10084 12.3957C2.10084 11.5143 2.81138 10.8007 3.68737 10.8007C4.56413 10.8007 5.2743 11.5143 5.2743 12.3957Z"
                                                fill="#404040"
                                            />
                                            <path
                                                d="M2 7.9718C2 8.19238 2.1718 8.37368 2.39103 8.38492C3.95966 8.4653 5.01464 9.03903 5.9863 10.0203C6.94114 10.9836 7.54851 12.3659 7.65282 13.6205C7.67066 13.8348 7.84888 14 8.06294 14H9.5375C9.65047 14 9.7585 13.9534 9.83626 13.8711C9.91407 13.7888 9.95472 13.6779 9.94894 13.5646C9.73897 9.43174 6.55076 6.2912 2.43287 6.08481C2.32016 6.07914 2.21015 6.12022 2.12837 6.19833C2.0466 6.27644 2 6.38486 2 6.49824V7.9718Z"
                                                fill="#404040"
                                            />
                                            <path
                                                d="M2 3.88931C2 4.11169 2.17458 4.29388 2.39571 4.30269C7.44633 4.50346 11.506 8.53079 11.7084 13.6025C11.7172 13.8244 11.8988 13.9999 12.1198 13.9999H13.588C13.6997 13.9999 13.8066 13.9543 13.8843 13.8736C13.9619 13.7929 14.0035 13.6839 13.9998 13.5717C13.7854 7.18196 8.78819 2.21318 2.42598 2.00023C2.31439 1.99649 2.2061 2.03843 2.12582 2.11644C2.04554 2.19439 2 2.30179 2 2.41398V3.88931Z"
                                                fill="#404040"
                                            />
                                        </svg>
                                    </DsTypography>
                                </a>
                            );
                        default:
                            return (
                                <DsTypography
                                    variant="Semibold_13"
                                    className={styles.blueMenuItem}
                                    onClick={() => navigateTo('/fsxhome/credentials')}
                                >
                                    Workload Factory credentials
                                </DsTypography>
                            );
                    }
                },
                items: [
                    {
                        id: MenuItems.links,
                        label: ''
                    },
                    {
                        id: MenuItems.credentials,
                        label: ''
                    },
                    {
                        id: MenuItems.hub,
                        label: ''
                    },
                    {
                        id: MenuItems.gitRepo,
                        label: ''
                    },
                    {
                        id: MenuItems.rss,
                        label: ''
                    }
                ]
            }}
            {...rest}
        />
    );
};
