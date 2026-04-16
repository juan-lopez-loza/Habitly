import { supabaseClient } from "../api/supabaseClient.js";

export async function setLog(habitId, value, date) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;

  const { data: existing } = await supabaseClient
    .from('logs')
    .select('id')
    .eq('habit_id', habitId)
    .eq('date', date)
    .maybeSingle();

  if (existing) {
    await supabaseClient
      .from('logs')
      .update({ value: typeof value === 'object' ? JSON.stringify(value) : value })
      .eq('id', existing.id);
  } else {
    await supabaseClient
      .from('logs')
      .insert({
        user_id: user.id,
        habit_id: habitId,
        date,
        value: typeof value === 'object' ? JSON.stringify(value) : value
      });
  }
}
