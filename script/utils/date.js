/**
 * HABITLY — date.js
 * Juan Lopez Loza
 * 01/04/2026
 */

export function today() {
    return new Date().toISOString().slice(0, 10);
}

export function offsetDate(offset) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
}

export function formatDisplayDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function isToday(dateStr) {
    return dateStr === today();
}
