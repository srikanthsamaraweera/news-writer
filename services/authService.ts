export interface AuthenticatedUser {
  id?: string | number;
  name?: string;
  email?: string;
  roles?: string[];
}

export interface AuthStatus {
  authenticated: boolean;
  user: AuthenticatedUser | null;
}

export const getAuthStatus = async (): Promise<AuthStatus> => {
  const response = await fetch("/api/auth/status", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Unable to check login status.");
  }

  return response.json();
};

export const startWordPressLogin = () => {
  window.location.href = "/api/auth/login";
};

export const logout = () => {
  window.location.href = "/api/auth/logout";
};
