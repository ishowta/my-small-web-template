/* tslint:disable */
/* eslint-disable */
// @generated
// This file was automatically generated and should not be edited.

// ====================================================
// GraphQL query operation: GetUser
// ====================================================

export interface GetUser_user {
  __typename: "User";
  /**
   * The user's public profile name.
   */
  name: string | null;
  /**
   * The user's public profile company.
   */
  company: string | null;
  /**
   * Identifies the date and time when the object was created.
   */
  createdAt: any;
}

export interface GetUser {
  /**
   * Lookup a user by login.
   */
  user: GetUser_user | null;
}
