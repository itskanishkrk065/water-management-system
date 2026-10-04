import React from 'react';
import UserManagementManager from '@/components/users/UserManagementManager';

export const metadata = {
  title: 'User Management & Device Control | WaterGrid Admin',
  description: 'Manage individual user accounts, roles, geographic scope, Argon2id passwords, and field devices.',
};

export default function UsersPage() {
  return <UserManagementManager />;
}
