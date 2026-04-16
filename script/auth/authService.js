/**
 * HABITLY — authService.js
 * Juan Lopez Loza
 * 01/04/2026
 */

import { supabaseClient } from "../api/supabaseClient.js";

let isSignUpMode = false;

// Authentification system
export function initAuthListeners(onSuccess) {
    const authForm = document.getElementById('authForm');
    if (!authForm) return;

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email    = document.getElementById('authEmail').value.trim();
        const password = document.getElementById('authPassword').value;
        const btn      = document.getElementById('authSubmitBtn');

        btn.disabled    = true;
        btn.textContent = isSignUpMode ? 'Inscription...' : 'Connexion...';

        const { error } = isSignUpMode
            ? await supabaseClient.auth.signUp({ email, password })
            : await supabaseClient.auth.signInWithPassword({ email, password });

        btn.disabled    = false;
        btn.textContent = isSignUpMode ? "S'inscrire" : 'Se connecter';

        if (error) { showAuthError(error.message); return; }

        if (isSignUpMode) {
            showAuthError('Compte créé ! Vérifie ton email pour confirmer.', true);
        } else if (onSuccess) {
            onSuccess();
        }
    });

    document.getElementById('switchToSignUp')?.addEventListener('click', (e) => {
        e.preventDefault();
        isSignUpMode = !isSignUpMode;
        document.getElementById('authTitle').textContent      = isSignUpMode ? 'Inscription'      : 'Connexion';
        document.getElementById('authSubmitBtn').textContent  = isSignUpMode ? "S'inscrire"       : 'Se connecter';
        document.getElementById('toggleText').textContent     = isSignUpMode ? 'Déjà un compte ?' : 'Pas de compte ?';
        document.getElementById('switchToSignUp').textContent = isSignUpMode ? 'Se connecter'     : "S'inscrire";
        clearAuthError();
    });

    // Toggle visibilité mot de passe
    const togglePwdBtn = document.getElementById('togglePassword');
    if (togglePwdBtn) {
        togglePwdBtn.addEventListener('click', () => {
            const input = document.getElementById('authPassword');
            const isHidden = input.type === 'password';
            input.type = isHidden ? 'text' : 'password';
            togglePwdBtn.textContent = isHidden ? '🙈' : '👁';
        });
    }
}

function showAuthError(msg, isSuccess = false) {
    let el = document.getElementById('authError');
    if (!el) {
        el = document.createElement('p');
        el.id = 'authError';
        el.style.cssText = 'margin-top:12px;font-size:13px;text-align:center;';
        document.getElementById('authForm')?.appendChild(el);
    }
    if (el) {
        el.style.color = isSuccess ? '#06D6A0' : '#FF3B30';
        el.textContent = msg;
    }
}

function clearAuthError() {
    const el = document.getElementById('authError');
    if (el) el.textContent = '';
}
