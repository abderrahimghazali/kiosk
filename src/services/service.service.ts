import { getSupabase } from '../db/supabase.js';
import type { Service, Variant, ServiceStep } from '../db/types.js';

export async function createService(data: {
  guild_id: string;
  name: string;
  description: string;
  category?: string;
  screenshots?: string[];
  steps?: ServiceStep[];
  is_active?: boolean;
}): Promise<Service> {
  const { data: service, error } = await getSupabase()
    .from('services')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return service;
}

export async function getService(serviceId: string): Promise<Service | null> {
  const { data, error } = await getSupabase()
    .from('services')
    .select('*')
    .eq('id', serviceId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getServicesByGuild(guildId: string): Promise<Service[]> {
  const { data, error } = await getSupabase()
    .from('services')
    .select('*')
    .eq('guild_id', guildId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function updateService(serviceId: string, updates: Partial<Service>): Promise<Service> {
  const { data, error } = await getSupabase()
    .from('services')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', serviceId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteService(serviceId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('services')
    .delete()
    .eq('id', serviceId);
  if (error) throw error;
}

// Variants

export async function createVariant(data: {
  service_id: string;
  name: string;
  description?: string;
  price: number;
  display_order?: number;
}): Promise<Variant> {
  const { data: variant, error } = await getSupabase()
    .from('variants')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return variant;
}

export async function getVariantsByService(serviceId: string): Promise<Variant[]> {
  const { data, error } = await getSupabase()
    .from('variants')
    .select('*')
    .eq('service_id', serviceId)
    .order('display_order', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getVariant(variantId: string): Promise<Variant | null> {
  const { data, error } = await getSupabase()
    .from('variants')
    .select('*')
    .eq('id', variantId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function deleteVariantsByService(serviceId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('variants')
    .delete()
    .eq('service_id', serviceId);
  if (error) throw error;
}
