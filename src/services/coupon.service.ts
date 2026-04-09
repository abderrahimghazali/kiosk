import { getSupabase } from '../db/supabase.js';
import type { Coupon } from '../db/types.js';

export async function createCoupon(data: {
  guild_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses?: number;
  service_id?: string;
  expires_at?: string;
}): Promise<Coupon> {
  const { data: coupon, error } = await getSupabase()
    .from('coupons')
    .insert(data)
    .select()
    .single();
  if (error) throw error;
  return coupon;
}

export async function getCouponByCode(guildId: string, code: string): Promise<Coupon | null> {
  const { data, error } = await getSupabase()
    .from('coupons')
    .select('*')
    .eq('guild_id', guildId)
    .ilike('code', code)
    .eq('is_active', true)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function getCouponsByGuild(guildId: string): Promise<Coupon[]> {
  const { data, error } = await getSupabase()
    .from('coupons')
    .select('*')
    .eq('guild_id', guildId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteCoupon(couponId: string): Promise<void> {
  const { error } = await getSupabase()
    .from('coupons')
    .delete()
    .eq('id', couponId);
  if (error) throw error;
}

export function validateCoupon(
  coupon: Coupon,
  serviceId: string
): { valid: boolean; reason?: string } {
  if (!coupon.is_active) return { valid: false, reason: 'This coupon is no longer active.' };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date())
    return { valid: false, reason: 'This coupon has expired.' };
  if (coupon.max_uses !== null && coupon.times_used >= coupon.max_uses)
    return { valid: false, reason: 'This coupon has reached its usage limit.' };
  if (coupon.service_id && coupon.service_id !== serviceId)
    return { valid: false, reason: 'This coupon does not apply to this service.' };
  return { valid: true };
}

export function calculateDiscount(coupon: Coupon, priceInCents: number): number {
  if (coupon.discount_type === 'percentage') {
    return Math.round(priceInCents * coupon.discount_value / 100);
  }
  return Math.min(coupon.discount_value, priceInCents);
}

export async function recordCouponUsage(
  couponId: string,
  orderId: string,
  customerDiscordId: string,
  discountAmount: number
): Promise<void> {
  const { data: coupon } = await getSupabase()
    .from('coupons')
    .select('times_used')
    .eq('id', couponId)
    .single();

  await getSupabase()
    .from('coupons')
    .update({ times_used: (coupon?.times_used ?? 0) + 1 })
    .eq('id', couponId);

  await getSupabase()
    .from('coupon_usages')
    .insert({
      coupon_id: couponId,
      order_id: orderId,
      customer_discord_id: customerDiscordId,
      discount_amount: discountAmount,
    });
}
