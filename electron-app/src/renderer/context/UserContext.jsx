import React, { createContext, useContext, useEffect, useState } from 'react';
import { getUserByEmail } from '../api/auth';

const UserContext = createContext();

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to get user details only once on mount
    const token = localStorage.getItem('token');
    getUserByEmail(token).then(res => {
      if (res.success) {
        setUser(res); // Adjust according to your API's response shape
      }
      setLoading(false);
    });
  }, []);

  return (
    <UserContext.Provider value={{ user, setUser, loading }}>
      {children}
    </UserContext.Provider>
  );
}

// Custom hook for easy access
export function useUser() {
  return useContext(UserContext);
}
