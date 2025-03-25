export interface Credential {
  id: string;
  userId: string;
  service: string;
  username: string;
  password: string; // Should be encrypted at rest
  isActive: boolean;
  createdAt: string; // ISO 8601 format
  updatedAt: string; // ISO 8601 format
} 