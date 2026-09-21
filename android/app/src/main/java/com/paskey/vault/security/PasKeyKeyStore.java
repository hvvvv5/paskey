package com.paskey.vault.security;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;

import java.security.KeyStore;

import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;

public final class PasKeyKeyStore {

    private static final String ANDROID_KEYSTORE = "AndroidKeyStore";
    private static final String KEY_ALIAS = "PasKeyVaultKey";
    private static final String BIOMETRIC_KEY_ALIAS = "PasKeyBiometricVaultKeyV2";

    private PasKeyKeyStore() {}

    public static SecretKey getOrCreateKey() throws Exception {
       KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        if (keyStore.containsAlias(KEY_ALIAS)) {
            KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);

            if (entry instanceof KeyStore.SecretKeyEntry) {
                return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
            }

            keyStore.deleteEntry(KEY_ALIAS);
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
        );

        KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT |
                KeyProperties.PURPOSE_DECRYPT
        )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(false)
                .build();

        keyGenerator.init(spec);

        return keyGenerator.generateKey();
    }

    public static boolean exists() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        return keyStore.containsAlias(KEY_ALIAS);
    }

    public static SecretKey getOrCreateBiometricKey() throws Exception {
        KeyStore keyStore = loadKeyStore();
        if (keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) {
            KeyStore.Entry entry = keyStore.getEntry(BIOMETRIC_KEY_ALIAS, null);
            if (entry instanceof KeyStore.SecretKeyEntry) {
                return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
            }
            keyStore.deleteEntry(BIOMETRIC_KEY_ALIAS);
        }

        KeyGenerator keyGenerator = KeyGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_AES,
                ANDROID_KEYSTORE
        );
        KeyGenParameterSpec.Builder builder = new KeyGenParameterSpec.Builder(
                BIOMETRIC_KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
        )
                .setKeySize(256)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setUserAuthenticationRequired(true)
                .setInvalidatedByBiometricEnrollment(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            builder.setUserAuthenticationParameters(0, KeyProperties.AUTH_BIOMETRIC_STRONG);
        } else {
            builder.setUserAuthenticationValidityDurationSeconds(-1);
        }

        keyGenerator.init(builder.build());
        return keyGenerator.generateKey();
    }

    public static SecretKey getBiometricKey() throws Exception {
        KeyStore keyStore = loadKeyStore();
        if (!keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) return null;
        KeyStore.Entry entry = keyStore.getEntry(BIOMETRIC_KEY_ALIAS, null);
        return entry instanceof KeyStore.SecretKeyEntry
                ? ((KeyStore.SecretKeyEntry) entry).getSecretKey()
                : null;
    }

    public static boolean biometricKeyExists() throws Exception {
        return loadKeyStore().containsAlias(BIOMETRIC_KEY_ALIAS);
    }

    public static void deleteBiometricKey() throws Exception {
        KeyStore keyStore = loadKeyStore();
        if (keyStore.containsAlias(BIOMETRIC_KEY_ALIAS)) {
            keyStore.deleteEntry(BIOMETRIC_KEY_ALIAS);
        }
    }

    public static void deleteKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);

        if (keyStore.containsAlias(KEY_ALIAS)) {
           keyStore.deleteEntry(KEY_ALIAS);
        }
    }

    private static KeyStore loadKeyStore() throws Exception {
        KeyStore keyStore = KeyStore.getInstance(ANDROID_KEYSTORE);
        keyStore.load(null);
        return keyStore;
    }
}
