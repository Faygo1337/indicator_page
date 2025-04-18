import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CryptoCard } from '@/lib/api/types';

interface CardsState {
  cards: { [key: string]: CryptoCard };
}

const initialState: CardsState = {
  cards: {}
};

const cardsSlice = createSlice({
  name: 'cards',
  initialState,
  reducers: {
    addCard: (state, action: PayloadAction<CryptoCard>) => {
      state.cards[action.payload.id] = action.payload;
    },
    updateCard: (state, action: PayloadAction<{ token: string; updates: Partial<CryptoCard> }>) => {
      const { token, updates } = action.payload;
      if (state.cards[token]) {
        state.cards[token] = { ...state.cards[token], ...updates };
      }
    }
  }
});

export const { addCard, updateCard } = cardsSlice.actions;
export default cardsSlice.reducer; 