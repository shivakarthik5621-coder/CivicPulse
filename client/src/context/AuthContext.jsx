import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('civicpulse_token');
    const savedAdmin = localStorage.getItem('civicpulse_admin');
    if (savedToken && savedAdmin) {
      setToken(savedToken);
      setAdmin(JSON.parse(savedAdmin));
    }
    setLoading(false);
  }, []);

  const login = (tokenData, adminData) => {
    localStorage.setItem('civicpulse_token', tokenData);
    localStorage.setItem('civicpulse_admin', JSON.stringify(adminData));
    setToken(tokenData);
    setAdmin(adminData);
  };

  const logout = () => {
    localStorage.removeItem('civicpulse_token');
    localStorage.removeItem('civicpulse_admin');
    setToken(null);
    setAdmin(null);
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ admin, token, loading, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
