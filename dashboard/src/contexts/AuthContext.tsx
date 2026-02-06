'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
  displayName: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // Validate token on mount
  useEffect(() => {
    const validateToken = async () => {
      try {
        const storedToken = localStorage.getItem('starfish_token');
        if (!storedToken) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${apiUrl}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${storedToken}`,
          },
        });

        if (response.ok) {
          const userData = await response.json();
          setToken(storedToken);
          setUser(userData);
        } else {
          // Token is invalid, clear it
          localStorage.removeItem('starfish_token');
        }
      } catch (error) {
        console.error('Failed to validate token:', error);
        localStorage.removeItem('starfish_token');
      } finally {
        setIsLoading(false);
      }
    };

    validateToken();
  }, [apiUrl]);

  const login = async (loginInput: string, password: string) => {
    try {
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          login: loginInput,
          password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || 'Invalid credentials'
        );
      }

      const data = await response.json();
      const { token: newToken, user: userData } = data;

      localStorage.setItem('starfish_token', newToken);
      setToken(newToken);
      setUser(userData);
    } catch (error) {
      localStorage.removeItem('starfish_token');
      setToken(null);
      setUser(null);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('starfish_token');
    setToken(null);
    setUser(null);
  };

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isLoading,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
