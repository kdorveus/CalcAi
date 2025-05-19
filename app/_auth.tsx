/*
import { Redirect, Stack } from 'expo-router';
// import { useAuth } from '../contexts/AuthContext'; // Commented out

// This layout protects routes by requiring authentication
// Commenting out as protection is handled in app/_layout.tsx
export default function AuthLayout() {
  // const { user, loading } = useAuth(); // Commented out

  // Show loading indicator while checking authentication
  // if (loading) { // Commented out
  //   return null; // Commented out
  // } // Commented out

  // If user is not authenticated, redirect to login
  // if (!user) { // Commented out
  //   return <Redirect href="/auth/login" />; // Commented out
  // } // Commented out

  // If authenticated, allow access to protected routes
  // Always render stack now
  return <Stack />;
}
*/

// Return null or an empty fragment to disable this layout
import React from 'react';
export default function AuthLayoutDisabled() {
    return null;
}
