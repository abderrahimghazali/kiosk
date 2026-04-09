import { getSupabase } from '../db/supabase.js';
import type { Order, StepResponse } from '../db/types.js';

export async function createOrder(data: {
  guild_id: string;
  service_id: string;
  variant_id: string;
  customer_discord_id: string;
  customer_discord_username: string;
  selected_variant_name: string;
  step_responses: StepResponse[];
  total_price: number;
  currency: string;
  coupon_id?: string | null;
  discount_amount?: number;
}): Promise<Order> {
  const { data: order, error } = await getSupabase()
    .from('orders')
    .insert({ ...data, status: 'pending_payment' })
    .select()
    .single();
  if (error) throw error;
  return order;
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const { data, error } = await getSupabase()
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<Order> {
  const { data, error } = await getSupabase()
    .from('orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getOrdersByGuild(
  guildId: string,
  filters?: { status?: string; customer_discord_id?: string; service_id?: string },
  limit = 25,
  offset = 0
): Promise<Order[]> {
  let query = getSupabase()
    .from('orders')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.customer_discord_id) query = query.eq('customer_discord_id', filters.customer_discord_id);
  if (filters?.service_id) query = query.eq('service_id', filters.service_id);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

/** Atomically transition order status. Returns null if the order wasn't in expectedStatus. */
export async function transitionOrderStatus(
  orderId: string,
  expectedStatus: string,
  updates: Partial<Order>
): Promise<Order | null> {
  const { data, error } = await getSupabase()
    .from('orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('status', expectedStatus)
    .select()
    .single();
  if (error && error.code === 'PGRST116') return null; // no row matched
  if (error) throw error;
  return data;
}

export function shortOrderId(orderId: string): string {
  return orderId.slice(0, 8).toUpperCase();
}
