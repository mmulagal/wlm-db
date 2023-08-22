import styles from './ResourceHeader.module.scss';
import { ReactComponent as SqlIcon } from '../../../assets/sql-icon.svg';
import { ReactComponent as ReloadIcon } from '../../../assets/reload-icon.svg';
import { ReactComponent as MenuIcon } from '../../../assets/menu-icon.svg';
import { NavLink, useLocation } from 'react-router-dom';
import { Button, Typography, ButtonWithDropdown } from '@netapp/design-system';
import { useMemo } from 'react';
import { GENERAL } from '../../../utils/appConstants';

type ResourceHeaderProps = {
    name?: string;
};

const ResourceHeader = ({ name }: ResourceHeaderProps) => {
    const tabs = [
        { url: 'overview', name: 'Overview' },
        { url: 'databases', name: 'Databases' },
        { url: 'tables', name: 'Tables' }
    ];
    const { pathname } = useLocation();

    const selectedTab = useMemo(() => {
        const splitPath = pathname.split('/');
        return splitPath.length ? splitPath[splitPath.length - 1] : 'overview';
    }, [pathname]);

    return (
        <div className={styles.headerContainer}>
            <SqlIcon className={styles.sqlIcon} />
            <Typography variant="Regular_20" className={styles.resourceName}>
                {name}
            </Typography>
            <div className={styles.tabsContainer}>
                {tabs.map((tabData: any) => {
                    return (
                        <NavLink to={tabData.url} className={({ isActive }) => (isActive ? styles['active'] : '')}>
                            <Typography
                                variant={selectedTab === tabData.url ? 'Semibold_16' : 'Regular_16'}
                                className={`${styles.tabItem} ${
                                    selectedTab === tabData.url ? styles.selectedItem : ''
                                }`}
                            >
                                {tabData.name}
                            </Typography>
                        </NavLink>
                    );
                })}
            </div>
            <div className={styles.rightContainer}>
                <Button
                    variant="secondary"
                    onClick={() => {
                        console.log('timeline clicked');
                    }}
                    className={styles.timelineButton}
                >
                    {GENERAL.TIMELINE}
                </Button>
                <Button
                    variant="icon"
                    onClick={() => {
                        console.log('reload clicked');
                    }}
                >
                    <ReloadIcon />
                </Button>
                <ButtonWithDropdown
                    variant="icon"
                    items={[
                        {
                            children: (
                                <div
                                    className={styles.menuItem}
                                    onClick={() => {
                                        console.log('remove workspace clicked');
                                    }}
                                >
                                    <Typography variant="Regular_14">{GENERAL.REMOVE_FROM_WORKSPACE}</Typography>
                                </div>
                            )
                        }
                    ]}
                    placement={'bottom-end'}
                >
                    <MenuIcon />
                </ButtonWithDropdown>
            </div>
        </div>
    );
};

export default ResourceHeader;
