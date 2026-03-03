# Redux Store Setup

This directory contains the Redux store configuration for the TAFS WebApp.

## Files

- **store.ts**: Main store configuration
- **hooks.ts**: Custom typed hooks for Redux (`useAppDispatch` and `useAppSelector`)
- **slices/**: Redux slices containing reducers and actions

## Usage

### Creating a New Slice

1. Create a new file in the `slices/` directory (e.g., `authSlice.ts`)
2. Define your state type, initial state, and slice
3. Export the slice reducer and actions

Example:
```typescript
import { createSlice } from '@reduxjs/toolkit';

interface AuthState {
  isLoggedIn: boolean;
  user: string | null;
}

const initialState: AuthState = {
  isLoggedIn: false,
  user: null,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login: (state, action) => {
      state.isLoggedIn = true;
      state.user = action.payload;
    },
    logout: (state) => {
      state.isLoggedIn = false;
      state.user = null;
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
```

### Registering a Slice

Add your slice to the store configuration in `store.ts`:
```typescript
import authReducer from './slices/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    example: exampleReducer,
  },
});
```

### Using Redux in Components

Use the custom hooks in your components:
```typescript
'use client';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { login, logout } from '@/store/slices/authSlice';

export default function LoginComponent() {
  const dispatch = useAppDispatch();
  const { isLoggedIn, user } = useAppSelector(state => state.auth);

  const handleLogin = () => {
    dispatch(login('John Doe'));
  };

  return (
    <div>
      {isLoggedIn ? (
        <p>Welcome, {user}!</p>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  );
}
```

## Key Points

- Always use `useAppDispatch` and `useAppSelector` instead of the plain Redux hooks for type safety
- Remember to add `'use client'` at the top of components that use Redux hooks
- Components that use Redux must be Client Components
