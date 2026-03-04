import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import studentsReducer from './slices/studentsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    students: studentsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;