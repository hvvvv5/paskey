package com.paskey.vault.credential;

import android.content.Context;
import android.content.SharedPreferences;

import com.paskey.vault.security.PasKeyKeyStore;

/** Shared checks for the Credential Provider and its activities. */
final class CredentialProviderSecurity {

    private static final String PREFS = "paskey_biometric_vault";
    private static final String CIPHERTEXT = "wrapped_data_key";
    private static final String IV = "wrapped_data_key_iv";
    private static final String VERSION = "wrapper_version";

    private CredentialProviderSecurity() {}

    static boolean hasBiometricWrapper(Context context) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            return prefs.getInt(VERSION, 0) == 2
                    && prefs.contains(CIPHERTEXT)
                    && prefs.contains(IV)
                    && PasKeyKeyStore.biometricKeyExists();
        } catch (Exception ignored) {
            return false;
        }
    }

    static String ciphertextKey() { return CIPHERTEXT; }
    static String ivKey() { return IV; }
    static String prefsName() { return PREFS; }
}
