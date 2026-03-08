import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import studentsReducer from './slices/studentsSlice';
import classesReducer from './slices/classesSlice';
import feeTypesReducer from './slices/feeTypesSlice';
import sectionsReducer from './slices/sectionsSlice';
import campusesReducer from './slices/campusesSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    students: studentsReducer,
    classes: classesReducer,
    feeTypes: feeTypesReducer,
    sections: sectionsReducer,
    campuses: campusesReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;