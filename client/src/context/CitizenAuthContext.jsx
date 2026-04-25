import { createContext, useContext, useState, useEffect } from 'react';

const CitizenAuthContext = createContext(null);

export function CitizenAuthProvider({ children }) {
  const [citizen, setCitizen] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('civicpulse_citizen_token');
    const savedCitizen = localStorage.getItem('civicpulse_citizen');
    if (savedToken && savedCitizen) {
      setToken(savedToken);
      setCitizen(JSON.parse(savedCitizen));
    }
    setLoading(false);
  }, []);

  const login = (tokenData, citizenData) => {
    localStorage.setItem('civicpulse_citizen_token', tokenData);
    localStorage.setItem('civicpulse_citizen', JSON.stringify(citizenData));
    setToken(tokenData);
    setCitizen(citizenData);
  };

  const logout = () => {
    localStorage.removeItem('civicpulse_citizen_token');
    localStorage.removeItem('civicpulse_citizen');
    setToken(null);
    setCitizen(null);
  };

  const isAuthenticated = !!token;

  return (
    <CitizenAuthContext.Provider value={{ citizen, token, loading, isAuthenticated, login, logout }}>
      {children}
    </CitizenAuthContext.Provider>
  );
}

export const useCitizenAuth = () => {
  const context = useContext(CitizenAuthContext);
  if (!context) throw new Error('useCitizenAuth must be used within CitizenAuthProvider');
  return context;
};
