package com.paskey.vault.plugin;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.provider.MediaStore;
import android.print.PrintManager;
import android.print.PrintDocumentAdapter;
import android.print.PrintAttributes;
import android.view.autofill.AutofillManager;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.security.keystore.KeyPermanentlyInvalidatedException;
import android.security.keystore.UserNotAuthenticatedException;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.WebViewClient;
import android.webkit.WebView;
import android.webkit.WebSettings;

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

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
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
    public void saveHtmlPdfToDownloads(PluginCall call) {
        String filename = call.getString("filename");
        String html = call.getString("html");
        if (filename == null || filename.trim().isEmpty() || html == null || html.trim().isEmpty()) {
            call.reject("filename and html are required");
            return;
        }

        FragmentActivity activity = getActivity();
        if (!isUsableActivity(activity)) {
            call.reject("Activity unavailable");
            return;
        }

        String normalizedName = filename.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (!normalizedName.toLowerCase().endsWith(".pdf")) normalizedName += ".pdf";
        final String safeName = normalizedName;
        final String jobName = safeName.substring(0, safeName.length() - 4);

        activity.runOnUiThread(() -> {
            WebView webView = new WebView(activity);
            try {
                WebSettings settings = webView.getSettings();
                settings.setDefaultTextEncodingName("UTF-8");
                settings.setJavaScriptEnabled(false);
                settings.setAllowFileAccess(false);
                settings.setAllowContentAccess(false);

                AtomicBoolean finished = new AtomicBoolean(false);
                webView.setWebViewClient(new WebViewClient() {
                    @Override
                    public void onPageFinished(WebView view, String url) {
                        if (!finished.compareAndSet(false, true)) return;

                        try {
                            PrintManager printManager =
                                    (PrintManager) activity.getSystemService(Context.PRINT_SERVICE);
                            if (printManager == null) {
                                view.destroy();
                                call.reject("Android print service is unavailable");
                                return;
                            }

                            PrintDocumentAdapter adapter =
                                    view.createPrintDocumentAdapter(jobName);

                            PrintAttributes attributes = new PrintAttributes.Builder()
                                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                                    .setResolution(new PrintAttributes.Resolution(
                                            "paskey_pdf",
                                            "PasKey PDF",
                                            600,
                                            600
                                    ))
                                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                                    .build();

                            printManager.print(jobName, adapter, attributes);

                            JSObject result = new JSObject();
                            result.put("saved", true);
                            result.put("filename", safeName);
                            result.put("location", "Android print dialog");
                            result.put("printDialog", true);
                            call.resolve(result);

                            // Do not destroy the WebView immediately: the Android
                            // print framework still reads from its adapter while
                            // the system print/save dialog is open.
                            new Handler(Looper.getMainLooper()).postDelayed(
                                    view::destroy,
                                    120000L
                            );
                        } catch (Exception exception) {
                            view.destroy();
                            call.reject("Unable to open Android PDF print dialog", exception);
                        }
                    }
                });

                webView.loadDataWithBaseURL(
                        "https://paskey.local/",
                        html,
                        "text/html",
                        "UTF-8",
                        null
                );
            } catch (Exception exception) {
                webView.destroy();
                call.reject("Unable to prepare PDF document", exception);
            }
        });
    }

    @PluginMethod
    public void savePdfToDownloads(PluginCall call) {
        String filename = call.getString("filename");
        String base64 = call.getString("base64");
        if (filename == null || filename.trim().isEmpty() || base64 == null || base64.isEmpty()) {
            call.reject("filename and base64 are required");
            return;
        }

        String safeName = filename.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
        if (!safeName.toLowerCase().endsWith(".pdf")) safeName += ".pdf";

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            JSObject result = new JSObject();

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                values.put(
                        MediaStore.Downloads.RELATIVE_PATH,
                        Environment.DIRECTORY_DOWNLOADS + "/PasKey"
                );
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                Uri uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new IllegalStateException("Android could not create the PDF in Downloads");

                boolean completed = false;
                try (OutputStream output = resolver.openOutputStream(uri, "w")) {
                    if (output == null) throw new IllegalStateException("Android could not open the PDF destination");
                    output.write(bytes);
                    output.flush();
                    completed = true;
                } finally {
                    if (!completed) {
                        try { resolver.delete(uri, null, null); } catch (Exception ignored) {}
                    }
                }

                ContentValues ready = new ContentValues();
                ready.put(MediaStore.Downloads.IS_PENDING, 0);
                resolver.update(uri, ready, null, null);

                result.put("saved", true);
                result.put("filename", safeName);
                result.put("location", "Downloads/PasKey/" + safeName);
                result.put("uri", uri.toString());
                call.resolve(result);
                return;
            }

            File publicDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            File directory = new File(publicDownloads, "PasKey");
            if (!directory.exists() && !directory.mkdirs()) {
                throw new IllegalStateException("Unable to create Downloads/PasKey");
            }
            File outputFile = new File(directory, safeName);
            try (FileOutputStream output = new FileOutputStream(outputFile, false)) {
                output.write(bytes);
                output.flush();
            }

            result.put("saved", true);
            result.put("filename", safeName);
            result.put("location", "Downloads/PasKey/" + safeName);
            result.put("uri", Uri.fromFile(outputFile).toString());
            call.resolve(result);
        } catch (Exception publicError) {
            try {
                File fallbackRoot = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (fallbackRoot == null) throw publicError;
                File directory = new File(fallbackRoot, "PasKey");
                if (!directory.exists() && !directory.mkdirs()) throw publicError;
                File outputFile = new File(directory, safeName);
                try (FileOutputStream output = new FileOutputStream(outputFile, false)) {
                    output.write(Base64.decode(base64, Base64.DEFAULT));
                    output.flush();
                }
                JSObject result = new JSObject();
                result.put("saved", true);
                result.put("filename", safeName);
                result.put("location", outputFile.getAbsolutePath());
                result.put("uri", Uri.fromFile(outputFile).toString());
                result.put("fallback", true);
                call.resolve(result);
            } catch (Exception fallbackError) {
                call.reject("Unable to save PDF on this device", fallbackError);
            }
        }
    }

    @PluginMethod
    public void authenticateSensitiveAction(PluginCall call) {
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
            AtomicBoolean completed = new AtomicBoolean(false);
            try {
                Executor executor = ContextCompat.getMainExecutor(activity);
                BiometricPrompt prompt = new BiometricPrompt(
                        activity,
                        executor,
                        new BiometricPrompt.AuthenticationCallback() {
                            @Override
                            public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                                if (!completed.compareAndSet(false, true)) return;
                                JSObject response = new JSObject();
                                response.put("verified", true);
                                call.resolve(response);
                            }

                            @Override
                            public void onAuthenticationError(int errorCode, CharSequence errorText) {
                                if (!completed.compareAndSet(false, true)) return;
                                call.reject(biometricAuthenticationError(errorCode, errorText));
                            }

                            @Override
                            public void onAuthenticationFailed() {
                                // Android keeps the prompt open so the user can retry.
                            }
                        }
                );
                prompt.authenticate(strongPromptInfo(
                        "Confirm sensitive export",
                        "Verify your identity before exporting readable passwords",
                        "Use Master Password"
                ));
            } catch (Exception exception) {
                if (completed.compareAndSet(false, true)) {
                    call.reject("Unable to start biometric authentication. Use your Master Password.", exception);
                }
            }
        });
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
    public void openChromeAutofillSettings(PluginCall call) {
        FragmentActivity activity = getActivity();
        if (!isUsableActivity(activity)) {
            call.reject("Activity unavailable");
            return;
        }

        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(Intent.ACTION_APPLICATION_PREFERENCES);
                intent.addCategory(Intent.CATEGORY_DEFAULT);
                intent.addCategory(Intent.CATEGORY_APP_BROWSER);
                intent.addCategory(Intent.CATEGORY_PREFERENCE);
                intent.setPackage("com.android.chrome");
                activity.startActivity(intent);
                JSObject result = new JSObject();
                result.put("opened", true);
                call.resolve(result);
            } catch (Exception exception) {
                call.reject("Unable to open Chrome Autofill settings", exception);
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
