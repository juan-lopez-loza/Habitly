import { supabaseClient } from "../api/supabaseClient.js";

export async function fetchHabits() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabaseClient
    .from('habits')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erreur habits:', error);
    return [];
  }
  return data || [];
}

export async function fetchLogs() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return {};

  const { data, error } = await supabaseClient
    .from('logs')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('Erreur logs:', error);
    return {};
  }

  const logs = {};
  (data || []).forEach(row => {
    if (!logs[row.date]) logs[row.date] = {};
    let val = row.value;
    if (typeof val === 'string') {
      try { val = JSON.parse(val); } catch { /* laisse en string */ }
    }
    logs[row.date][row.habit_id] = val;
  });
  return logs;
}

export async function saveHabit(habitData, editingId = null) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Session expirée');

  const payload = { ...habitData, user_id: user.id };

  if (editingId) {
    const { error } = await supabaseClient.from('habits').update(payload).eq('id', editingId);
    if (error) throw error;
  } else {
    const { error } = await supabaseClient.from('habits').insert(payload);
    if (error) throw error;
  }
}

export async function deleteHabit(id) {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) throw new Error('Session expirée');

  await supabaseClient.from('logs').delete().eq('habit_id', id).eq('user_id', user.id);
  const { error } = await supabaseClient.from('habits').delete().eq('id', id);
  if (error) throw error;
}
