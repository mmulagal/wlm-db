import { PayloadAction, createSlice } from '@reduxjs/toolkit';

export type LinkOption = 'createNewLink' | 'associateExistingLink';

interface AssociatedLinksItem {
    [key: string]: any;
}

interface AssociatedLinksData {
    count: number;
    items: AssociatedLinksItem[];
    nextToken: string | null;
}

interface CRRRedirectionState {
    associatedLinks: AssociatedLinksData;
    associatedLinksLoading: boolean;
    associatedLinksError: any;
    selectedLinkOption: LinkOption;
    fsxDetailsLoading: boolean;
    fsxDetails: any;
    existingLinks: AssociatedLinksData;
    existingLinksLoading: boolean;
    selectedExistingLink: any;
    associateLinkLoading: boolean;
    showLinkError: boolean;
}

const initialState: CRRRedirectionState = {
    associatedLinks: {
        count: 0,
        items: [],
        nextToken: null
    },
    associatedLinksLoading: false,
    associatedLinksError: null,
    selectedLinkOption: 'createNewLink',
    fsxDetailsLoading: false,
    fsxDetails: null,
    existingLinks: {
        count: 0,
        items: [],
        nextToken: null
    },
    existingLinksLoading: false,
    selectedExistingLink: null,
    associateLinkLoading: false,
    showLinkError: false
};

const crrRedirectionSlice = createSlice({
    name: 'crrRedirection',
    initialState,
    reducers: {
        setAssociatedLinks: (state, action: PayloadAction<AssociatedLinksData>) => {
            state.associatedLinks = action.payload;
        },

        setSelectedLinkOption: (state, action: PayloadAction<LinkOption>) => {
            state.selectedLinkOption = action.payload;
        },
        setFsxDetailsLoading: (state, action: PayloadAction<boolean>) => {
            state.fsxDetailsLoading = action.payload;
        },
        setFsxDetails: (state, action: PayloadAction<any>) => {
            state.fsxDetails = action.payload;
        },
        setExistingLinksLoading: (state, action: PayloadAction<boolean>) => {
            state.existingLinksLoading = action.payload;
        },
        setExistingLinks: (state, action: PayloadAction<AssociatedLinksData>) => {
            state.existingLinks = action.payload;
        },
        setSelectedExistingLink: (state, action: PayloadAction<any>) => {
            state.selectedExistingLink = action.payload;
        },
        setAssociateLinkLoading: (state, action: PayloadAction<boolean>) => {
            state.associateLinkLoading = action.payload;
        },
        setShowLinkError: (state, action: PayloadAction<boolean>) => {
            state.showLinkError = action.payload;
        }
    }
});

export const {
    setAssociatedLinks,

    setSelectedLinkOption,
    setFsxDetailsLoading,
    setFsxDetails,
    setExistingLinksLoading,
    setExistingLinks,
    setSelectedExistingLink,
    setAssociateLinkLoading,
    setShowLinkError
} = crrRedirectionSlice.actions;

export default crrRedirectionSlice;
