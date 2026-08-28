export type Role = "student" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface LoginCredentials {
  email: string;
  password: string;
  role: Role;
}

export interface SignUpDetails {
  firstName: string;
  middleInitial?: string;
  lastName: string;
  nameExtension?: string;
  studentId: string;
  email: string;
  password: string;
}
