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
  created_at: string;
  updated_at: string;
}
