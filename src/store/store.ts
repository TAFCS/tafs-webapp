import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import studentsReducer from './slices/studentsSlice';
import classesReducer from './slices/classesSlice';
import feeTypesReducer from './slices/feeTypesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    students: studentsReducer,
    classes: classesReducer,
    feeTypes: feeTypesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;