import React from 'react';
import MenuPopover from '../../../common/MenuPopover/MenuPopover';
import CommonStyles from '../../../utils/CommonStyles.module.scss';

const MENU_ITEMS = [{ id: 'delete', displayName: 'Delete' }];

interface DeleteMenuCellProps {
    isDemoMode: boolean;
    isBulkSelected: boolean;
    rowData: any;
    menuOpenedRow: string | null;
    menuOpenedRowDetail: React.MutableRefObject<any>;
    setOpenedRow: (id: string | null) => void;
    onDelete: (rowData: any) => void;
}

const DeleteMenuCell = ({
    isDemoMode,
    isBulkSelected,
    rowData,
    menuOpenedRow,
    menuOpenedRowDetail,
    setOpenedRow,
    onDelete
}: DeleteMenuCellProps) => (
    <div className={CommonStyles.deleteMenu}>
        {!isDemoMode && !isBulkSelected && (
            <MenuPopover
                isMenuOpen={menuOpenedRowDetail.current === rowData.id || menuOpenedRow === rowData.id}
                menuItems={MENU_ITEMS}
                toggleMenu={(toggleType: string, menuId: string) => {
                    if (toggleType === 'close') {
                        menuOpenedRowDetail.current = null;
                        setOpenedRow(null);
                    } else if (toggleType === 'open') {
                        menuOpenedRowDetail.current = null;
                        setOpenedRow(rowData.id);
                        menuOpenedRowDetail.current = rowData.id;
                    } else if (toggleType === 'selectedOption') {
                        menuOpenedRowDetail.current = null;
                        setOpenedRow(null);

                        switch (menuId) {
                            case 'delete':
                                onDelete(rowData);
                                break;
                        }
                    }
                }}
                isDisabled={rowData?.menuDisable}
            />
        )}

        {(isDemoMode || isBulkSelected) && (
            <div className={CommonStyles.menuPointerDisabled}>
                <span className={CommonStyles.menuPointer}>...</span>
            </div>
        )}
    </div>
);

export default DeleteMenuCell;
