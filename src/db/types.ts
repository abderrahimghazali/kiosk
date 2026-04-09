export interface GuildConfig {
  id: string;
  guild_id: string;
  catalog_channel_id: string | null;
  orders_channel_id: string | null;
  log_channel_id: string | null;
  stripe_secret_key: string;
  stripe_webhook_secret: string;
  currency: string;
  catalog_message_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ServiceStep {
  prompt: string;
  type: 'text' | 'select';
  choices?: string[];
}

export interface Service {
  id: string;
  guild_id: string;
  name: string;
  description: string;
  category: string;
  screenshots: string[];
  steps: ServiceStep[];
  is_active: boolean;
  catalog_message_id: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface Variant {
  id: string;
  service_id: string;
  name: string;
  description: string | null;
  price: number;
  display_order: number;
  created_at: string;
}

export interface StepResponse {
  prompt: string;
  answer: string;
}

export interface Order {
  id: string;
  guild_id: string;
  service_id: string;
  variant_id: string;
  customer_discord_id: string;
  customer_discord_username: string;
  selected_variant_name: string;
  step_responses: StepResponse[];
  status: 'pending_payment' | 'paid' | 'in_progress' | 'completed' | 'cancelled' | 'refunded';
  total_price: number;
  currency: string;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  order_admin_message_id: string | null;
  coupon_id: string | null;
  discount_amount: number;
  created_at: string;
  updated_at: string;
}

export interface StaffRole {
  id: string;
  guild_id: string;
  name: string;
  categories: string[];
  created_at: string;
}

export interface StaffMember {
  id: string;
  guild_id: string;
  user_id: string;
  role_id: string;
  joined_at: string;
}

export interface ApplicationResponse {
  question: string;
  answer: string;
}

export interface StaffApplication {
  id: string;
  guild_id: string;
  user_id: string;
  username: string;
  responses: ApplicationResponse[];
  status: 'pending' | 'accepted' | 'rejected';
  reviewed_by: string | null;
  assigned_role_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  guild_id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  times_used: number;
  service_id: string | null;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}
