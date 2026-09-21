package com.paskey.vault.plugin;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.view.autofill.AutofillManager;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.UserNotAuthenticatedException;
import android.util.Base64;
import android.view.WindowManager;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.paskey.vault.autofill.PasKeyAutofillStore;
import com.paskey.vault.security.PasKeyKeyStore;
import com.paskey.vault.storage.PasKeyVaultDatabase;
import com.paskey.vault.storage.VaultRecordEntity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import javax.crypto.AEADBadTagException;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "PasKeySecurity")
public class PasKeySecurityPlugin extends Plugin {

    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final String BIOMETRIC_PREFS = "paskey_biometric_vault";
    private static final String BIOMETRIC_CIPHERTEXT = "wrapped_data_key";
    private static final String BIOMETRIC_IV = "wrapped_data_key_iv";
    private static final String BIOMETRIC_WRAPPER_VERSION = "wrapper_version";
    private static final int CURRENT_BIOMETRIC_WRAPPER_VERSION = 2;
    private static final int BIOMETRIC_DISCOVERY_AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_WEAK;
    private static final int BIOMETRIC_KEY_AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_STRONG;
    private static final ExecutorService STORAGE_EXECUTOR = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void isKeystoreAvailable(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("available", true);
            result.put("keyExists", PasKeyKeyStore.exists());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Android Keystore unavailable", exception);
        }
    }

    @PluginMethod
    public void encrypt(PluginCall call) {
        String plaintext = call.getString("plaintext");
        if (plaintext == null) {
            call.reject("plaintext is required");
            return;
        }
        try {
            SecretKey key = PasKeyKeyStore.getOrCreateKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, key);
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            JSObject result = new JSObject();
            result.put("ciphertext", Base64.encodeToString(encrypted, Base64.NO_WRAP));
            result.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Encryption failed", exception);
        }
    }

    @PluginMethod
    public void decrypt(PluginCall call) {
        String ciphertextB64 = call.getString("ciphertext");
        String ivB64 = call.getString("iv");
        if (ciphertextB64 == null || ivB64 == null) {
            call.reject("ciphertext and iv are required");
            return;
        }
        try {
            SecretKey key = PasKeyKeyStore.getOrCreateKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP)));
            byte[] decrypted = cipher.doFinal(Base64.decode(ciphertextB64, Base64.NO_WRAP));
            JSObject result = new JSObject();
            result.put("plaintext", new String(decrypted, StandardCharsets.UTF_8));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Decryption failed", exception);
        }
    }

    @PluginMethod
    public void wrapKey(PluginCall call) {
        String keyB64 = call.getString("key");
        if (keyB64 == null) {
            call.reject("key is required");
            return;
        }
        try {
            SecretKey deviceKey = PasKeyKeyStore.getOrCreateKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, deviceKey);
            byte[] wrapped = cipher.doFinal(Base64.decode(keyB64, Base64.NO_WRAP));
            JSObject result = new JSObject();
            result.put("wrapped", Base64.encodeToString(wrapped, Base64.NO_WRAP));
            result.put("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Key wrapping failed", exception);
        }
    }

    @PluginMethod
    public void unwrapKey(PluginCall call) {
        String wrappedB64 = call.getString("wrapped");
        String ivB64 = call.getString("iv");
        if (wrappedB64 == null || ivB64 == null) {
            call.reject("wrapped and iv are required");
            return;
        }
        try {
            SecretKey deviceKey = PasKeyKeyStore.getOrCreateKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, deviceKey, new GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP)));
            byte[] rawKey = cipher.doFinal(Base64.decode(wrappedB64, Base64.NO_WRAP));
            JSObject result = new JSObject();
            result.put("key", Base64.encodeToString(rawKey, Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Key unwrapping failed", exception);
        }
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        FragmentActivity activity = getActivity();
        if (!isUsableActivity(activity)) {
            call.reject("Activity unavailable");
            return;
        }
        String availabilityError = biometricKeyAvailabilityError(activity);
        if (availabilityError != null) {
            call.reject(availabilityError);
            return;
        }
        activity.runOnUiThread(() -> {
            try {
                Executor executor = ContextCompat.getMainExecutor(activity);
                BiometricPrompt prompt = new BiometricPrompt(activity, executor,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                JSObject response = new JSObject();
                                response.put("authenticated", true);
                                call.resolve(response);
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, CharSequence errorText) {
                                JSObject response = new JSObject();
                                response.put("authenticated", false);
                                response.put("errorCode", errorCode);
                                response.put("error", biometricAuthenticationError(errorCode, errorText));
                                call.resolve(response);
                            }
                        });
                prompt.authenticate(strongPromptInfo("Unlock PasKey", "Verify your identity", "Use Master Password"));
            } catch (Exception exception) {
                call.reject("Unable to start Android biometric authentication", exception);
            }
        });
    }

    /**
     * Stores the current extractable vault data key encrypted by the Android
     * Keystore only after an Android biometric confirmation. The encrypted
     * wrapper is independent of the Master Password wrapper, so changing a
     * Master Password does not alter any vault record or biometric setting.
     */
    @PluginMethod
    public void enableBiometricVaultKey(PluginCall call) {
        String keyB64 = call.getString("key");
        if (keyB64 == null) {
            call.reject("key is required");
            return;
        }

        final byte[] rawKey;
        try {
            rawKey = Base64.decode(keyB64, Base64.NO_WRAP);
            if (rawKey.length != 32) throw new IllegalArgumentException("Expected a 256-bit vault key");
        } catch (Exception exception) {
            call.reject("Invalid vault key", exception);
            return;
        }

        FragmentActivity activity = getActivity();
        if (!isUsableActivity(activity)) {
            call.reject("Activity unavailable");
            return;
        }
        String availabilityError = biometricKeyAvailabilityError(activity);
        if (availabilityError != null) {
            call.reject(availabilityError);
            return;
        }
        AtomicBoolean completed = new AtomicBoolean(false);
        activity.runOnUiThread(() -> {
            try {
                Cipher cipher = createBiometricEncryptionCipher();
                Executor executor = ContextCompat.getMainExecutor(activity);
                BiometricPrompt prompt = new BiometricPrompt(activity, executor,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                if (!completed.compareAndSet(false, true)) return;
                                try {
                                    BiometricPrompt.CryptoObject cryptoObject = result.getCryptoObject();
                                    Cipher authenticatedCipher = cryptoObject == null ? null : cryptoObject.getCipher();
                                    if (authenticatedCipher == null) {
                                        throw new IllegalStateException("Android did not return an authenticated cipher");
                                    }
                                    byte[] ciphertext = authenticatedCipher.doFinal(rawKey);
                                    boolean saved = biometricPrefs().edit()
                                            .putInt(BIOMETRIC_WRAPPER_VERSION, CURRENT_BIOMETRIC_WRAPPER_VERSION)
                                            .putString(BIOMETRIC_CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                                            .putString(BIOMETRIC_IV, Base64.encodeToString(authenticatedCipher.getIV(), Base64.NO_WRAP))
                                            .commit();
                                    if (!saved) throw new IllegalStateException("Unable to save biometric vault key");
                                    JSObject response = new JSObject();
                                    response.put("enabled", true);
                                    call.resolve(response);
                                } catch (Exception exception) {
                                    if (isPermanentlyInvalidated(exception)) {
                                        clearBiometricMaterial();
                                        call.reject(invalidatedBiometricMessage(), exception);
                                    } else if (isUserNotAuthenticated(exception)) {
                                        call.reject("Android did not authorize the Keystore operation. Try again or use your Master Password.", exception);
                                    } else {
                                        call.reject("Unable to enable biometric unlock. Your vault is unchanged.", exception);
                                    }
                                }
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, CharSequence errorText) {
                                if (!completed.compareAndSet(false, true)) return;
                                call.reject(biometricAuthenticationError(errorCode, errorText));
                            }
                        });
                prompt.authenticate(
                        strongPromptInfo("Enable PasKey biometric unlock", "Confirm a strong fingerprint or secure face", "Cancel"),
                        new BiometricPrompt.CryptoObject(cipher)
                );
            } catch (KeyPermanentlyInvalidatedException exception) {
                clearBiometricMaterial();
                if (completed.compareAndSet(false, true)) call.reject(invalidatedBiometricMessage(), exception);
            } catch (Exception exception) {
                if (completed.compareAndSet(false, true)) {
                    call.reject("Unable to start biometric setup. Your vault is unchanged.", exception);
                }
            }
        });
    }

    /** Releases the wrapped data key only after Android BiometricPrompt succeeds. */
    @PluginMethod
    public void unlockBiometricVaultKey(PluginCall call) {
        SharedPreferences prefs = biometricPrefs();
        int wrapperVersion = prefs.getInt(BIOMETRIC_WRAPPER_VERSION, 0);
        String ciphertextB64 = prefs.getString(BIOMETRIC_CIPHERTEXT, null);
        String ivB64 = prefs.getString(BIOMETRIC_IV, null);
        if (wrapperVersion != CURRENT_BIOMETRIC_WRAPPER_VERSION || ciphertextB64 == null || ivB64 == null) {
            call.reject("Biometric unlock must be enabled again with your Master Password.");
            return;
        }

        FragmentActivity activity = getActivity();
        if (!isUsableActivity(activity)) {
            call.reject("Activity unavailable");
            return;
        }
        String availabilityError = biometricKeyAvailabilityError(activity);
        if (availabilityError != null) {
            call.reject(availabilityError);
            return;
        }
        AtomicBoolean completed = new AtomicBoolean(false);
        activity.runOnUiThread(() -> {
            try {
                Cipher cipher = createBiometricDecryptionCipher(ivB64);
                Executor executor = ContextCompat.getMainExecutor(activity);
                BiometricPrompt prompt = new BiometricPrompt(activity, executor,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                if (!completed.compareAndSet(false, true)) return;
                                try {
                                    BiometricPrompt.CryptoObject cryptoObject = result.getCryptoObject();
                                    Cipher authenticatedCipher = cryptoObject == null ? null : cryptoObject.getCipher();
                                    if (authenticatedCipher == null) {
                                        throw new IllegalStateException("Android did not return an authenticated cipher");
                                    }
                                    byte[] rawKey = authenticatedCipher.doFinal(Base64.decode(ciphertextB64, Base64.NO_WRAP));
                                    if (rawKey.length != 32) throw new IllegalStateException("Invalid biometric vault key");
                                    JSObject response = new JSObject();
                                    response.put("key", Base64.encodeToString(rawKey, Base64.NO_WRAP));
                                    call.resolve(response);
                                } catch (AEADBadTagException exception) {
                                    clearBiometricMaterial();
                                    call.reject("Biometric unlock data is no longer valid. Use your Master Password and enable it again. Your vault is unchanged.", exception);
                                } catch (Exception exception) {
                                    if (isPermanentlyInvalidated(exception)) {
                                        clearBiometricMaterial();
                                        call.reject(invalidatedBiometricMessage(), exception);
                                    } else if (isUserNotAuthenticated(exception)) {
                                        call.reject("Android did not authorize the Keystore operation. Try again or use your Master Password.", exception);
                                    } else {
                                        call.reject("Unable to unlock with biometrics. Use your Master Password; your vault is unchanged.", exception);
                                    }
                                }
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, CharSequence errorText) {
                                if (!completed.compareAndSet(false, true)) return;
                                call.reject(biometricAuthenticationError(errorCode, errorText));
                            }
                        });
                prompt.authenticate(
                        strongPromptInfo("Unlock PasKey", "Use a strong fingerprint or secure face", "Use Master Password"),
                        new BiometricPrompt.CryptoObject(cipher)
                );
            } catch (KeyPermanentlyInvalidatedException exception) {
                clearBiometricMaterial();
                if (completed.compareAndSet(false, true)) call.reject(invalidatedBiometricMessage(), exception);
            } catch (Exception exception) {
                if (isPermanentlyInvalidated(exception)) {
                    clearBiometricMaterial();
                    if (completed.compareAndSet(false, true)) call.reject(invalidatedBiometricMessage(), exception);
                } else if (completed.compareAndSet(false, true)) {
                    call.reject("Unable to start biometric unlock. Use your Master Password.", exception);
                }
            }
        });
    }

    @PluginMethod
    public void hasBiometricVaultKey(PluginCall call) {
        try {
            SharedPreferences prefs = biometricPrefs();
            boolean available = prefs.getInt(BIOMETRIC_WRAPPER_VERSION, 0) == CURRENT_BIOMETRIC_WRAPPER_VERSION
                    && prefs.contains(BIOMETRIC_CIPHERTEXT)
                    && prefs.contains(BIOMETRIC_IV)
                    && PasKeyKeyStore.biometricKeyExists();
            JSObject result = new JSObject();
            result.put("available", available);
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to inspect biometric unlock state", exception);
        }
    }

    @PluginMethod
    public void clearBiometricVaultKey(PluginCall call) {
        try {
            clearBiometricMaterial();
            call.resolve();
        } catch (Exception exception) {
            call.reject("Unable to clear biometric unlock", exception);
        }
    }


    @PluginMethod
    public void setScreenshotProtection(PluginCall call) {
        Boolean enabled = call.getBoolean("enabled", true);
        FragmentActivity activity = getActivity();
        if (!isUsableActivity(activity)) {
            call.reject("Activity unavailable");
            return;
        }
        activity.runOnUiThread(() -> {
            if (Boolean.TRUE.equals(enabled)) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE);
            }
            JSObject result = new JSObject();
            result.put("enabled", Boolean.TRUE.equals(enabled));
            call.resolve(result);
        });
    }

    @PluginMethod
    public void copySecure(PluginCall call) {
        String value = call.getString("value");
        Integer seconds = call.getInt("seconds", 30);
        if (value == null) {
            call.reject("value is required");
            return;
        }
        ClipboardManager clipboard = (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard == null) {
            call.reject("Clipboard unavailable");
            return;
        }
        clipboard.setPrimaryClip(ClipData.newPlainText("PasKey", value));
        if (seconds != null && seconds > 0) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    ClipData current = clipboard.getPrimaryClip();
                    if (current != null && current.getItemCount() > 0) {
                        CharSequence currentText = current.getItemAt(0).coerceToText(getContext());
                        if (currentText != null && value.contentEquals(currentText)) clipboard.clearPrimaryClip();
                    }
                } catch (Exception ignored) {
                    // Best-effort clipboard clearing must not crash the app.
                }
            }, seconds * 1000L);
        }
        call.resolve();
    }

    @PluginMethod
    public void getAutofillStatus(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            result.put("supported", false);
            result.put("enabled", false);
            call.resolve(result);
            return;
        }

        AutofillManager manager = getContext().getSystemService(AutofillManager.class);
        boolean supported = manager != null && manager.isAutofillSupported();
        boolean enabled = supported && manager.hasEnabledAutofillServices();
        result.put("supported", supported);
        result.put("enabled", enabled);
        call.resolve(result);
    }

    @PluginMethod
    public void requestEnableAutofill(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.reject("Android Autofill requires Android 8.0 or newer");
            return;
        }

        FragmentActivity activity = getActivity();
        if (!isUsableActivity(activity)) {
            call.reject("Activity unavailable");
            return;
        }

        AutofillManager manager = activity.getSystemService(AutofillManager.class);
        if (manager == null || !manager.isAutofillSupported()) {
            call.reject("Android Autofill is not supported on this device");
            return;
        }

        JSObject result = new JSObject();
        if (manager.hasEnabledAutofillServices()) {
            result.put("enabled", true);
            result.put("openedSettings", false);
            call.resolve(result);
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_SET_AUTOFILL_SERVICE);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                activity.startActivity(intent);
                JSObject response = new JSObject();
                response.put("enabled", false);
                response.put("openedSettings", true);
                call.resolve(response);
            } catch (Exception exception) {
                call.reject("Unable to open Android Autofill settings", exception);
            }
        });
    }

    @PluginMethod
    public void syncAutofillVault(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        try {
            JSONArray items = new JSONArray(json);
            PasKeyAutofillStore.save(getContext(), items);
            JSObject result = new JSObject();
            result.put("saved", true);
            result.put("count", items.length());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Autofill vault sync failed", exception);
        }
    }

    @PluginMethod
    public void clearAutofillVault(PluginCall call) {
        try {
            PasKeyAutofillStore.clear(getContext());
            PasKeyAutofillStore.clearPending(getContext());
            call.resolve();
        } catch (Exception exception) {
            call.reject("Unable to clear Autofill vault", exception);
        }
    }

    /**
     * Reads one vault entity from Room. Each record is independently sealed
     * with the non-exportable Android Keystore AES-256-GCM key.
     */
    @PluginMethod
    public void readVaultEntity(PluginCall call) {
        String entity = call.getString("entity");
        if (entity == null || entity.trim().isEmpty()) {
            call.reject("entity is required");
            return;
        }
        STORAGE_EXECUTOR.execute(() -> {
            try {
                JSONArray result = new JSONArray();
                List<VaultRecordEntity> records = PasKeyVaultDatabase.get(getContext()).records().findByEntity(entity);
                for (VaultRecordEntity record : records) {
                    byte[] plaintext = decryptDevice(record.ciphertext, record.iv);
                    result.put(new JSONObject(new String(plaintext, StandardCharsets.UTF_8)));
                }
                JSObject response = new JSObject();
                response.put("json", result.toString());
                call.resolve(response);
            } catch (Exception exception) {
                call.reject("Unable to read encrypted vault storage", exception);
            }
        });
    }

    /** Writes a complete entity snapshot transactionally through Room. */
    @PluginMethod
    public void writeVaultEntity(PluginCall call) {
        String entity = call.getString("entity");
        String json = call.getString("json");
        if (entity == null || entity.trim().isEmpty() || json == null) {
            call.reject("entity and json are required");
            return;
        }
        STORAGE_EXECUTOR.execute(() -> {
            try {
                JSONArray items = new JSONArray(json);
                List<VaultRecordEntity> records = new ArrayList<>();
                for (int i = 0; i < items.length(); i++) {
                    JSONObject item = items.optJSONObject(i);
                    if (item == null) continue;
                    String id = item.optString("id", "").trim();
                    if (id.isEmpty()) throw new IllegalArgumentException("Vault record id is missing");
                    CipherPayload sealed = encryptDevice(item.toString().getBytes(StandardCharsets.UTF_8));
                    records.add(new VaultRecordEntity(entity, id, sealed.ciphertext, sealed.iv));
                }
                PasKeyVaultDatabase database = PasKeyVaultDatabase.get(getContext());
                database.runInTransaction(() -> {
                    database.records().deleteEntity(entity);
                    if (!records.isEmpty()) database.records().upsertAll(records);
                });
                call.resolve();
            } catch (Exception exception) {
                call.reject("Unable to write encrypted vault storage", exception);
            }
        });
    }

    @PluginMethod
    public void clearVaultStorage(PluginCall call) {
        STORAGE_EXECUTOR.execute(() -> {
            try {
                PasKeyVaultDatabase.get(getContext()).records().deleteAll();
                call.resolve();
            } catch (Exception exception) {
                call.reject("Unable to clear encrypted vault storage", exception);
            }
        });
    }

    @PluginMethod
    public void getPendingAutofillSaves(PluginCall call) {
        try {
            JSObject result = new JSObject();
            result.put("json", PasKeyAutofillStore.loadPending(getContext()).toString());
            call.resolve(result);
        } catch (Exception exception) {
            call.reject("Unable to load pending Autofill saves", exception);
        }
    }

    @PluginMethod
    public void clearPendingAutofillSaves(PluginCall call) {
        try {
            PasKeyAutofillStore.clearPending(getContext());
            call.resolve();
        } catch (Exception exception) {
            call.reject("Unable to clear pending Autofill saves", exception);
        }
    }

    @PluginMethod
    public void removePendingAutofillSaves(PluginCall call) {
        String json = call.getString("json");
        if (json == null) {
            call.reject("json is required");
            return;
        }
        try {
            PasKeyAutofillStore.removePending(getContext(), new JSONArray(json));
            call.resolve();
        } catch (Exception exception) {
            call.reject("Unable to remove pending Autofill saves", exception);
        }
    }

    private SharedPreferences biometricPrefs() {
        return getContext().getSharedPreferences(BIOMETRIC_PREFS, Context.MODE_PRIVATE);
    }

    private CipherPayload encryptDevice(byte[] plaintext) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, PasKeyKeyStore.getOrCreateKey());
        return new CipherPayload(
                Base64.encodeToString(cipher.doFinal(plaintext), Base64.NO_WRAP),
                Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
        );
    }

    private byte[] decryptDevice(String ciphertextB64, String ivB64) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(
                Cipher.DECRYPT_MODE,
                PasKeyKeyStore.getOrCreateKey(),
                new GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP))
        );
        return cipher.doFinal(Base64.decode(ciphertextB64, Base64.NO_WRAP));
    }

    private static final class CipherPayload {
        final String ciphertext;
        final String iv;

        CipherPayload(String ciphertext, String iv) {
            this.ciphertext = ciphertext;
            this.iv = iv;
        }
    }

    private BiometricPrompt.PromptInfo strongPromptInfo(String title, String subtitle, String negativeButton) {
        return new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(BIOMETRIC_KEY_AUTHENTICATORS)
                .setNegativeButtonText(negativeButton)
                .build();
    }

    private String biometricKeyAvailabilityError(Context context) {
        BiometricManager manager = BiometricManager.from(context);
        int weakResult = manager.canAuthenticate(BIOMETRIC_DISCOVERY_AUTHENTICATORS);
        int strongResult = manager.canAuthenticate(BIOMETRIC_KEY_AUTHENTICATORS);
        if (strongResult == BiometricManager.BIOMETRIC_SUCCESS) return null;
        if (weakResult == BiometricManager.BIOMETRIC_SUCCESS) {
            return "Android found a fingerprint or face, but it is not classified as strong enough to protect the vault key. Use an enrolled strong fingerprint or secure face, or use your Master Password.";
        }
        if (strongResult == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED
                || weakResult == BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED) {
            return "No strong fingerprint or secure face is enrolled. Enroll one in Android settings, then use your Master Password.";
        }
        if (strongResult == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE
                || weakResult == BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE) {
            return "This device does not support fingerprint or face authentication. Use your Master Password.";
        }
        if (strongResult == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE
                || weakResult == BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE) {
            return "Fingerprint or face authentication is temporarily unavailable. Try again or use your Master Password.";
        }
        return "Strong fingerprint or secure face authentication is unavailable. Use your Master Password.";
    }

    private String biometricAuthenticationError(int errorCode, CharSequence errorText) {
        if (errorCode == BiometricPrompt.ERROR_NEGATIVE_BUTTON
                || errorCode == BiometricPrompt.ERROR_USER_CANCELED
                || errorCode == BiometricPrompt.ERROR_CANCELED) {
            return "Biometric check was cancelled. Use your Master Password.";
        }
        if (errorCode == BiometricPrompt.ERROR_NO_BIOMETRICS) {
            return "No fingerprint or face is enrolled. Enroll one in Android settings, then use your Master Password.";
        }
        if (errorCode == BiometricPrompt.ERROR_LOCKOUT
                || errorCode == BiometricPrompt.ERROR_LOCKOUT_PERMANENT) {
            return "Biometric authentication is locked after too many attempts. Use your Master Password.";
        }
        String detail = errorText == null ? "Unknown Android biometric error" : errorText.toString();
        return "Fingerprint or face authentication was not completed: " + detail + ". Use your Master Password.";
    }

    private Cipher createBiometricEncryptionCipher() throws Exception {
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, PasKeyKeyStore.getOrCreateBiometricKey());
            return cipher;
        } catch (Exception exception) {
            if (!isPermanentlyInvalidated(exception)) throw exception;
            clearBiometricMaterial();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, PasKeyKeyStore.getOrCreateBiometricKey());
            return cipher;
        }
    }

    private Cipher createBiometricDecryptionCipher(String ivB64) throws Exception {
        SecretKey key = PasKeyKeyStore.getBiometricKey();
        if (key == null) throw new IllegalStateException("Biometric Keystore key is missing");
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                new GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP))
        );
        return cipher;
    }

    private boolean isUsableActivity(FragmentActivity activity) {
        return activity != null && !activity.isFinishing() && !activity.isDestroyed();
    }

    private void clearBiometricMaterial() {
        biometricPrefs().edit().clear().commit();
        try {
            PasKeyKeyStore.deleteBiometricKey();
        } catch (Exception ignored) {
            // The Master Password wrapper remains intact even if Keystore cleanup fails.
        }
    }

    private boolean isPermanentlyInvalidated(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof KeyPermanentlyInvalidatedException) return true;
            current = current.getCause();
        }
        return false;
    }

    private boolean isUserNotAuthenticated(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            if (current instanceof UserNotAuthenticatedException) return true;
            current = current.getCause();
        }
        return false;
    }

    private String invalidatedBiometricMessage() {
        return "BIOMETRIC_KEY_INVALIDATED: Android invalidated the biometric key after a security or enrollment change. Use your Master Password and enable biometric unlock again. Your vault data is unchanged.";
    }
}
