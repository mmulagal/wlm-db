import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { ChatbotEntities } from '../../utils/types/chatbotTypes';

const initialState: ChatbotEntities = {
    messages: [],
    currentIntent: '',
    isShow: false
};

const chatbotSlice = createSlice({
    name: 'chatbot',
    initialState,
    reducers: {
        setMessages: (state, action: PayloadAction<any>) => {
            state.messages = action.payload;
        },
        setCurrentIntent: (state, action: PayloadAction<any>) => {
            state.currentIntent = action.payload;
        },
        setIsShow: (state, action: PayloadAction<any>) => {
            state.isShow = action.payload;
        }
    }
});

export const { setMessages, setCurrentIntent, setIsShow } = chatbotSlice.actions;
export default chatbotSlice;
