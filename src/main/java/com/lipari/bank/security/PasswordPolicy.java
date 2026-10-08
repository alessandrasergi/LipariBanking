package com.lipari.bank.security;

import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;

/**
 * Politica delle password del LipariBank. Validazione pura: la password
 * esiste solo come parametro di chiamata, non viene loggata, salvata o
 * restituita in nessun formato.
 */
@Component
public class PasswordPolicy {

    private static final int MIN_LENGTH = 12;
    private static final int MAX_LENGTH = 64;

    private static final List<String> COMMON_PASSWORDS = List.of(
            "password12345", "123456789012", "qwertyuiop12", "iloveyou1234",
            "liparibank123", "bancaitaliana1", "welcome12345");

    /**
     * Valuta la password secondo la politica in vigore.
     *
     * @param rawPassword password proposta dall'utente
     * @param username    nome utente, usato per escludere nomi riusabili (puo' essere null)
     * @throws IllegalArgumentException se la password non rispetta la politica;
     *         il messaggio non contiene mai la password proposta
     */
    public void validate(String rawPassword, String username) {
        if (rawPassword == null || rawPassword.isEmpty()) {
            throw new IllegalArgumentException("password is required");
        }
        if (rawPassword.length() < MIN_LENGTH) {
            throw new IllegalArgumentException("password must be at least " + MIN_LENGTH + " characters");
        }
        if (rawPassword.length() > MAX_LENGTH) {
            throw new IllegalArgumentException("password must be at most " + MAX_LENGTH + " characters");
        }

        String lowered = rawPassword.toLowerCase(Locale.ROOT);

        if (COMMON_PASSWORDS.contains(lowered)) {
            throw new IllegalArgumentException("password is among the most common ones");
        }

        if (username != null && !username.isBlank()
                && lowered.contains(username.toLowerCase(Locale.ROOT))) {
            throw new IllegalArgumentException("password must not contain the username");
        }

        if (isSingleCharacter(lowered)) {
            throw new IllegalArgumentException("password must not be a single repeated character");
        }
    }

    private boolean isSingleCharacter(String value) {
        char first = value.charAt(0);
        for (int i = 1; i < value.length(); i++) {
            if (value.charAt(i) != first) {
                return false;
            }
        }
        return true;
    }
}
