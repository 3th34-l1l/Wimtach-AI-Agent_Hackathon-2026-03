"use client";
import { createContext, useContext, useEffect, useState } from "react";

type User = {
  name: string;
  email: string;
  role: string;
};

const AuthContext = createContext<any>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("ems_user");
    if (stored) setUser(JSON.parse(stored));
  }, []);

  function login(data: User) {
    localStorage.setItem("ems_user", JSON.stringify(data));
    setUser(data);
  }

  function logout() {
    localStorage.removeItem("ems_user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}