/**
 * HABITLY — supabaseClient.js
 * Juan Lopez Loza
 * 01/04/2026
 */

const supabaseUrl = 'https://jabkrcknmymguutdqfco.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImphYmtyY2tubXltZ3V1dGRxZmNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE1Mzc5NTcsImV4cCI6MjA4NzExMzk1N30.2wlbxB1r2rsnGZqNBAB1mIu2JbcCVYsHW_VmO_Xle5Q';

export const supabaseClient = supabase.createClient(
    supabaseUrl,
    supabaseKey,
);