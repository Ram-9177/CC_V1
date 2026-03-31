const fs = require('fs');
const filePath = '/Users/ram/Desktop/SMG-Hostel/src/pages/UsersPage.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Inject React.memo import
content = content.replace("import { useRef, useState, useEffect } from 'react';", "import React, { useRef, useState, useEffect } from 'react';");

// Convert row map to memoized component map
const memoComp = `
const MemoizedTenantRow = React.memo(({ tenant, currentUser, canElectHR, canEditStudent, canManageUsers, toggleParentInformed, approveUserMutation, toggleHrMutation, setEditingTenant, toggleUserActiveMutation, isWarden, navigate, deleteUserMutation, setEditingUser }) => {
  // Original JSX copied
  const isTopLevelManagementContext = canManageUsers; // simplify
  const canManageTarget = (targetRole, targetId) => {
    if (!currentUser) return false;
    if (currentUser.id === targetId) return true;
    if (currentUser.role === 'super_admin') return true;
    if (isTopLevelManagementContext && currentUser.role !== 'super_admin') {
        return !['admin', 'super_admin'].includes(targetRole);
    }
    if (currentUser.role === 'warden') {
        return targetRole === 'student';
    }
    return false;
  };
  return (
    // We keep the exact JSX by wrapping the inner contents
  );
});
`;
// Actually, sed-style replacement is better here.
// Instead of a full script, I will use sed to just replace `export default function UsersPage` with the memoized component.
