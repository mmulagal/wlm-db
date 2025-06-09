import { NavLink, useLocation } from 'react-router-dom';
import { Button, Typography, ButtonWithDropdown } from '@netapp/design-system';
import { useMemo } from 'react';
import styles from './ResourceHeader.module.scss';
import { ReactComponent as SqlIcon } from '../../../assets/sql-icon.svg';
import { ReactComponent as ReloadIcon } from '../../../assets/reload-icon.svg';
import { ReactComponent as MenuIcon } from '../../../assets/menu-icon.svg';
import { GENERAL } from '../../../utils/appConstants';
import { navigateToCanvas } from '../../../utils/appConfig';

type ResourceHeaderProps = {
    name: string | (string | null)[] | null;
    refresh: () => void;
    onDeleteMssql: (event: React.MouseEvent<HTMLElement>) => void;
};

const ResourceHeader = ({ name, refresh, onDeleteMssql }: ResourceHeaderProps) => {
    const tabs = [
        { url: 'overview', name: GENERAL.OVERVIEW },
        { url: 'databases', name: GENERAL.DATABASES },
        { url: 'tables', name: GENERAL.TABLES }
    ];
    const { pathname } = useLocation();

    // @ts-ignore
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
                {tabs.map((tabData: any) => (
                    <NavLink to={tabData.url} className={({ isActive }) => (isActive ? styles.active : '')}>
                        <Typography
                            variant={selectedTab === tabData.url ? 'Semibold_16' : 'Regular_16'}
                            className={`${styles.tabItem} ${selectedTab === tabData.url ? styles.selectedItem : ''}`}
                        >
                            {tabData.name}
                        </Typography>
                    </NavLink>
                ))}
            </div>
            <div className={styles.rightContainer}>
                <Button
                    variant="secondary"
                    onClick={() => {
                        navigateToCanvas('/timeline');
                    }}
                    className={styles.timelineButton}
                >
                    {GENERAL.TIMELINE}
                </Button>
                <Button
                    variant="icon"
                    onClick={() => {
                        refresh();
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
                                    onClick={e => {
                                        onDeleteMssql(e);
                                    }}
                                >
                                    <Typography variant="Regular_14">{GENERAL.REMOVE_FROM_WORKSPACE}</Typography>
                                </div>
                            )
                        }
                    ]}
                    placement="bottom-end"
                >
                    <MenuIcon />
                </ButtonWithDropdown>
            </div>
        </div>
    );
};

export default ResourceHeader;
