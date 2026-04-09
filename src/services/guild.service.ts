import { getSupabase } from '../db/supabase.js';
import type { GuildConfig } from '../db/types.js';

export async function getGuildConfig(guildId: string): Promise<GuildConfig | null> {
  const { data, error } = await getSupabase()
    .from('guild_configs')
    .select('*')
    .eq('guild_id', guildId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertGuildConfig(
  guildId: string,
  config: Partial<Omit<GuildConfig, 'id' | 'guild_id' | 'created_at' | 'updated_at'>>
): Promise<GuildConfig> {
  const { data, error } = await getSupabase()
    .from('guild_configs')
    .upsert(
      { guild_id: guildId, ...config, updated_at: new Date().toISOString() },
      { onConflict: 'guild_id' }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
