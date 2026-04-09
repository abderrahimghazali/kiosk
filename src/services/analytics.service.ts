import { getSupabase } from '../db/supabase.js';
import type { Order } from '../db/types.js';

export interface AnalyticsData {
  period: string;
  totalRevenue: number;
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
  refundedOrders: number;
  averageOrderValue: number;
  totalDiscounts: number;
  uniqueCustomers: number;
  topServices: { name: string; orders: number; revenue: number }[];
  topCustomers: { id: string; orders: number; spent: number }[];
  statusBreakdown: Record<string, number>;
  revenueByDay: { date: string; revenue: number; orders: number }[];
}

export async function getAnalytics(
  guildId: string,
  periodDays: number
): Promise<AnalyticsData> {
  const since = new Date();
  since.setDate(since.getDate() - periodDays);
  const sinceISO = since.toISOString();

  const { data: orders, error } = await getSupabase()
    .from('orders')
    .select('*')
    .eq('guild_id', guildId)
    .gte('created_at', sinceISO)
    .order('created_at', { ascending: true });

  if (error) throw error;
  const all = (orders ?? []) as Order[];

  // Paid statuses (revenue-generating)
  const paidStatuses = ['paid', 'in_progress', 'completed'];
  const paidOrders = all.filter((o) => paidStatuses.includes(o.status));
  const completedOrders = all.filter((o) => o.status === 'completed');
  const refundedOrders = all.filter((o) => o.status === 'refunded');
  const pendingOrders = all.filter((o) => o.status === 'paid' || o.status === 'in_progress');

  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.total_price, 0);
  const totalDiscounts = all.reduce((sum, o) => sum + (o.discount_amount || 0), 0);
  const averageOrderValue = paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

  // Unique customers
  const customerSet = new Set(all.map((o) => o.customer_discord_id));

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  for (const o of all) {
    statusBreakdown[o.status] = (statusBreakdown[o.status] || 0) + 1;
  }

  // Top services (need service names — fetch from DB)
  const serviceMap = new Map<string, { name: string; orders: number; revenue: number }>();
  for (const o of paidOrders) {
    const existing = serviceMap.get(o.service_id) || { name: o.selected_variant_name.split(' ')[0], orders: 0, revenue: 0 };
    existing.orders++;
    existing.revenue += o.total_price;
    serviceMap.set(o.service_id, existing);
  }

  // Fetch service names
  const serviceIds = [...serviceMap.keys()];
  if (serviceIds.length > 0) {
    const { data: services } = await getSupabase()
      .from('services')
      .select('id, name')
      .in('id', serviceIds);
    for (const svc of services ?? []) {
      const entry = serviceMap.get(svc.id);
      if (entry) entry.name = svc.name;
    }
  }

  const topServices = [...serviceMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Top customers
  const customerMap = new Map<string, { id: string; orders: number; spent: number }>();
  for (const o of paidOrders) {
    const existing = customerMap.get(o.customer_discord_id) || { id: o.customer_discord_id, orders: 0, spent: 0 };
    existing.orders++;
    existing.spent += o.total_price;
    customerMap.set(o.customer_discord_id, existing);
  }

  const topCustomers = [...customerMap.values()]
    .sort((a, b) => b.spent - a.spent)
    .slice(0, 5);

  // Revenue by day
  const dayMap = new Map<string, { revenue: number; orders: number }>();
  for (const o of paidOrders) {
    const day = o.created_at.substring(0, 10);
    const existing = dayMap.get(day) || { revenue: 0, orders: 0 };
    existing.revenue += o.total_price;
    existing.orders++;
    dayMap.set(day, existing);
  }

  const revenueByDay = [...dayMap.entries()]
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const periodLabel = periodDays === 7 ? 'Last 7 days' : periodDays === 30 ? 'Last 30 days' : periodDays === 90 ? 'Last 90 days' : `Last ${periodDays} days`;

  return {
    period: periodLabel,
    totalRevenue,
    totalOrders: all.length,
    completedOrders: completedOrders.length,
    pendingOrders: pendingOrders.length,
    refundedOrders: refundedOrders.length,
    averageOrderValue,
    totalDiscounts,
    uniqueCustomers: customerSet.size,
    topServices,
    topCustomers,
    statusBreakdown,
    revenueByDay,
  };
}
