"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

export interface ArtistProfile {
  id: string;
  full_name: string;
  username: string;
  avatar?: string;
  avatar_thumbnail?: string;
  short_bio?: string;
  artist_statement?: string;
  website?: string;
  social_links?: Record<string, string>;
  location?: string;
  specialties?: string;
  is_featured: boolean;
  is_founder: boolean;
}

export interface User {
  id: string;
  email: string;
  is_artist: boolean;
  is_verified: boolean;
  is_staff: boolean;
  artist_profile?: ArtistProfile;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (data: any) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      await api.getCsrfToken();
      const userData = await api.getCurrentUser();
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (data: any): Promise<User> => {
    const userData = await api.login(data);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      await refreshUser();
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
