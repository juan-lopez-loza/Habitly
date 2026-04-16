/**
 * HABITLY — authHelpers.js
 * Juan Lopez Loza
 * 01/04/2026
 */

import {supabaseClient} from "../api/supabaseClient";

async function setLog(habitId, value, dateStr = null) {
    const d = dateStr || today();
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) return console.error('setLog: aucun utilisateur connecté');

    if (!logs[d]) logs[d] = {};
    logs[d][habitId] = value;

    const { error } = await supabaseClient
        .from('logs')
        .upsert(
            { user_id: user.id, habit_id: habitId, date: d, value },
            { onConflict: 'user_id,habit_id,date' }
        );

    if (error) console.error('Erreur setLog:', error);
}

function getLogForDate(habitId, dateStr) {
    return (logs[dateStr] || {})[habitId];
}

function isHabitDoneOnDate(habit, dateStr) {
    const val  = getLogForDate(habit.id, dateStr);
    const goal = habit.goal || 1;
    return habit.type === 'check'
        ? val === true
        : (typeof val === 'number' && val >= goal);
}