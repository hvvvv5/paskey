package com.paskey.vault.credential;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Base64;
import android.view.Window;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;
import androidx.credentials.CreatePasswordRequest;
import androidx.credentials.CreatePasswordResponse;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.GetPasswordOption;
import androidx.credentials.PasswordCredential;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.provider.BeginGetCredentialRequest;
import androidx.credentials.provider.BeginGetCredentialResponse;
import androidx.credentials.provider.BeginGetPasswordOption;
import androidx.credentials.provider.CredentialEntry;
import androidx.credentials.provider.PendingIntentHandler;
import androidx.credentials.provider.PasswordCredentialEntry;
import androidx.credentials.provider.ProviderCreateCredentialRequest;
import androidx.credentials.provider.ProviderGetCredentialRequest;

import com.paskey.vault.security.PasKeyKeyStore;

import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executor;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** Selection/authentication activity for Android Credential Manager entries. */
public final class PasKeyCredentialActivity extends FragmentActivity {

    public static final String EXTRA_MODE = "paskey_credential_mode";
    public static final String MODE_BEGIN_GET = "begin_get";
    public static final String MODE_GET = "get";
    public static final String MODE_CREATE = "create";
    private static final String EXTRA_RECORD_ID = "paskey_record_id";
    private static final String EXTRA_MODE_GET = "paskey_mode_get";
    private static final int AUTHENTICATORS = BiometricManager.Authenticators.BIOMETRIC_STRONG;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);
        if (!CredentialProviderSecurity.hasBiometricWrapper(this)) {
            finish();
            return;
        }
        startBiometricPrompt();
    }

    private void startBiometricPrompt() {
        try {
            Cipher cipher = createAuthenticatedCipher();
            Executor executor = ContextCompat.getMainExecutor(this);
            BiometricPrompt prompt = new BiometricPrompt(this, executor,
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override
                        public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                            try {
                                BiometricPrompt.CryptoObject crypto = result.getCryptoObject();
                                Cipher authenticated = crypto == null ? null : crypto.getCipher();
                                if (authenticated == null) throw new IllegalStateException("No authenticated cipher");
                                byte[] vaultKey = authenticated.doFinal(readWrappedCiphertext());
                                if (vaultKey.length != 32) throw new IllegalStateException("Invalid vault key");
                                complete(vaultKey);
                            } catch (Exception ignored) {
                                finish();
                            }
                        }

                        @Override
                        public void onAuthenticationError(int errorCode, CharSequence errorText) {
                            finish();
                        }
                    });
            BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
                    .setTitle("Unlock PasKey")
                    .setSubtitle("Authenticate to use your encrypted credentials")
                    .setAllowedAuthenticators(AUTHENTICATORS)
                    .setNegativeButtonText("Cancel")
                    .build();
            prompt.authenticate(info, new BiometricPrompt.CryptoObject(cipher));
        } catch (Exception ignored) {
            finish();
        }
    }

    private Cipher createAuthenticatedCipher() throws Exception {
        SecretKey key = PasKeyKeyStore.getBiometricKey();
        if (key == null) throw new IllegalStateException("Biometric key unavailable");
        android.content.SharedPreferences prefs = getSharedPreferences(
                CredentialProviderSecurity.prefsName(), MODE_PRIVATE);
        String iv = prefs.getString(CredentialProviderSecurity.ivKey(), null);
        if (iv == null) throw new IllegalStateException("Biometric wrapper unavailable");
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key,
                new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        return cipher;
    }

    private byte[] readWrappedCiphertext() {
        android.content.SharedPreferences prefs = getSharedPreferences(
                CredentialProviderSecurity.prefsName(), MODE_PRIVATE);
        return Base64.decode(prefs.getString(CredentialProviderSecurity.ciphertextKey(), ""), Base64.NO_WRAP);
    }

    private void complete(byte[] vaultKey) {
        String mode = getIntent().getStringExtra(EXTRA_MODE);
        try {
            if (MODE_BEGIN_GET.equals(mode)) {
                completeBeginGet(vaultKey);
            } else if (MODE_GET.equals(mode)) {
                completeGet(vaultKey);
            } else if (MODE_CREATE.equals(mode)) {
                completeCreate();
            } else {
                finish();
            }
        } catch (Exception ignored) {
            finish();
        }
    }

    private void completeBeginGet(byte[] vaultKey) throws Exception {
        BeginGetCredentialRequest request = PendingIntentHandler.retrieveBeginGetCredentialRequest(getIntent());
        if (request == null) {
            finish();
            return;
        }
        List<PasKeyCredentialStore.Login> logins = allLogins(vaultKey);
        String callingPackage = request.getCallingAppInfo() == null
                ? "" : request.getCallingAppInfo().getPackageName();
        List<CredentialEntry> entries = new ArrayList<>();
        for (androidx.credentials.provider.BeginGetCredentialOption rawOption : request.getBeginGetCredentialOptions()) {
            if (!(rawOption instanceof BeginGetPasswordOption)) continue;
            BeginGetPasswordOption option = (BeginGetPasswordOption) rawOption;
            Set<String> allowed = option.getAllowedUserIds();
            for (PasKeyCredentialStore.Login login : logins) {
                if (!matchesPackage(login, callingPackage) || !matchesAllowed(login, allowed)) continue;
                Intent intent = new Intent(this, PasKeyCredentialActivity.class)
                        .putExtra(EXTRA_MODE, MODE_GET)
                        .putExtra(EXTRA_RECORD_ID, login.id);
                android.app.PendingIntent pending = android.app.PendingIntent.getActivity(
                        this,
                        7200 + Math.abs(login.id.hashCode() % 100000),
                        intent,
                        android.app.PendingIntent.FLAG_MUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT);
                entries.add(new PasswordCredentialEntry(
                        this,
                        login.username,
                        pending,
                        option,
                        login.title,
                        Instant.now(),
                        null,
                        false,
                        null,
                        false
                ));
            }
        }
        Intent result = new Intent();
        PendingIntentHandler.setBeginGetCredentialResponse(
                result,
                new BeginGetCredentialResponse(entries, Collections.emptyList(), Collections.emptyList(), null));
        setResult(Activity.RESULT_OK, result);
        finish();
    }

    private void completeGet(byte[] vaultKey) throws Exception {
        ProviderGetCredentialRequest request = PendingIntentHandler.retrieveProviderGetCredentialRequest(getIntent());
        String id = getIntent().getStringExtra(EXTRA_RECORD_ID);
        if (request == null || id == null) {
            finish();
            return;
        }
        GetPasswordOption option = null;
        if (!request.getCredentialOptions().isEmpty()
                && request.getCredentialOptions().get(0) instanceof GetPasswordOption) {
            option = (GetPasswordOption) request.getCredentialOptions().get(0);
        }
        if (option == null) {
            finish();
            return;
        }
        PasKeyCredentialStore.Login selected = null;
        for (PasKeyCredentialStore.Login login : allLogins(vaultKey)) {
            if (id.equals(login.id)) {
                selected = login;
                break;
            }
        }
        if (selected == null || !matchesAllowed(selected, option.getAllowedUserIds())) {
            finish();
            return;
        }
        Intent result = new Intent();
        PendingIntentHandler.setGetCredentialResponse(
                result,
                new GetCredentialResponse(new PasswordCredential(selected.username, selected.password)));
        setResult(Activity.RESULT_OK, result);
        finish();
    }

    private void completeCreate() throws Exception {
        ProviderCreateCredentialRequest request = PendingIntentHandler.retrieveProviderCreateCredentialRequest(getIntent());
        if (request == null || !(request.getCallingRequest() instanceof CreatePasswordRequest)) {
            finish();
            return;
        }
        CreatePasswordRequest password = (CreatePasswordRequest) request.getCallingRequest();
        JSONObject pending = new JSONObject();
        pending.put("_paskeyPendingId", UUID.randomUUID().toString());
        pending.put("title", "Credential Manager");
        pending.put("username", password.getId());
        pending.put("password", password.getPassword());
        pending.put("applicationIdentifier", request.getCallingAppInfo() == null
                ? "" : request.getCallingAppInfo().getPackageName());
        com.paskey.vault.autofill.PasKeyAutofillStore.savePending(this, new org.json.JSONArray().put(pending));
        Intent result = new Intent();
        PendingIntentHandler.setCreateCredentialResponse(result, new CreatePasswordResponse());
        setResult(Activity.RESULT_OK, result);
        finish();
    }

    private List<PasKeyCredentialStore.Login> allLogins(byte[] vaultKey) throws Exception {
        List<PasKeyCredentialStore.Login> logins = new ArrayList<>();
        logins.addAll(PasKeyCredentialStore.readLogins(this, vaultKey));
        logins.addAll(PasKeyCredentialStore.readPending(this));
        return logins;
    }

    private boolean matchesPackage(PasKeyCredentialStore.Login login, String callingPackage) {
        if (login.applicationIdentifier == null || login.applicationIdentifier.trim().isEmpty()) return true;
        if (callingPackage == null || callingPackage.isEmpty()) return false;
        for (String candidate : login.applicationIdentifier.split(",")) {
            if (callingPackage.equals(candidate.trim())) return true;
        }
        return false;
    }

    private boolean matchesAllowed(PasKeyCredentialStore.Login login, Set<String> allowed) {
        return allowed == null || allowed.isEmpty() || allowed.contains(login.username);
    }
}
