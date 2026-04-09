import { getSupabase } from '../db/supabase.js';
import type { StaffRole, StaffMember, StaffApplication, ApplicationResponse } from '../db/types.js';

// --- Roles ---

export async function createStaffRole(data: {
  guild_id: string;
  name: string;
  categories: string[];
}): Promise<StaffRole> {
  const { data: role, error } = await getSupabase()
    .from('staff_roles')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return role;
}

export async function getStaffRoles(guildId: string): Promise<StaffRole[]> {
  const { data, error } = await getSupabase()
    .from('staff_roles')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getStaffRole(roleId: string): Promise<StaffRole | null> {
  const { data, error } = await getSupabase()
    .from('staff_roles')
    .select('*')
    .eq('id', roleId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function deleteStaffRole(roleId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('staff_roles')
    .delete()
    .eq('id', roleId);
  if (error) throw error;
}

// --- Members ---

export async function addStaffMember(data: {
  guild_id: string;
  user_id: string;
  role_id: string;
}): Promise<StaffMember> {
  const { data: member, error } = await getSupabase()
    .from('staff_members')
    .upsert(data, { onConflict: 'guild_id,user_id' })
    .select()
    .single();
  if (error) throw error;
  return member;
}

export async function getStaffMembers(guildId: string): Promise<StaffMember[]> {
  const { data, error } = await getSupabase()
    .from('staff_members')
    .select('*')
    .eq('guild_id', guildId)
    .order('joined_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getStaffMember(guildId: string, userId: string): Promise<StaffMember | null> {
  const { data, error } = await getSupabase()
    .from('staff_members')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function removeStaffMember(guildId: string, userId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('staff_members')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Check if a user is staff and can manage a given category */
export async function canStaffManageCategory(
  guildId: string,
  userId: string,
  category: string
): Promise<boolean> {
  const member = await getStaffMember(guildId, userId);
  if (!member) return false;
  const role = await getStaffRole(member.role_id);
  if (!role) return false;
  // Empty categories array means access to all
  if (role.categories.length === 0) return true;
  return role.categories.includes(category);
}

// --- Applications ---

export async function createApplication(data: {
  guild_id: string;
  user_id: string;
  username: string;
  responses: ApplicationResponse[];
}): Promise<StaffApplication> {
  const { data: app, error } = await getSupabase()
    .from('staff_applications')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return app;
}

export async function getApplication(appId: string): Promise<StaffApplication | null> {
  const { data, error } = await getSupabase()
    .from('staff_applications')
    .select('*')
    .eq('id', appId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getPendingApplication(guildId: string, userId: string): Promise<StaffApplication | null> {
  const { data, error } = await getSupabase()
    .from('staff_applications')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateApplication(
  appId: string,
  updates: Partial<StaffApplication>
): Promise<StaffApplication> {
  const { data, error } = await getSupabase()
    .from('staff_applications')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', appId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
