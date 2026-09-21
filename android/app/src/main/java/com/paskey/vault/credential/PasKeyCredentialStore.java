package com.paskey.vault.credential;

import android.content.Context;
import android.util.Base64;

import com.paskey.vault.autofill.PasKeyAutofillStore;
import com.paskey.vault.security.PasKeyKeyStore;
import com.paskey.vault.storage.PasKeyVaultDatabase;
import com.paskey.vault.storage.VaultRecordEntity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * Read-only bridge used by the Android 14+ credential provider. The provider
 * receives the browser vault key only after a strong BiometricPrompt; Room
 * rows remain encrypted by the Android Keystore key at rest.
 */
public final class PasKeyCredentialStore {

    private static final String DEVICE_TRANSFORMATION = "AES/GCM/NoPadding";

    private PasKeyCredentialStore() {}

    public static final class Login {
        public final String id;
        public final String title;
        public final String username;
        public final String password;
        public final String website;
        public final String applicationIdentifier;
        public final String updatedDate;

        Login(String id, String title, String username, String password,
              String website, String applicationIdentifier, String updatedDate) {
            this.id = id;
            this.title = title;
            this.username = username;
            this.password = password;
            this.website = website;
            this.applicationIdentifier = applicationIdentifier;
            this.updatedDate = updatedDate;
        }
    }

    public static List<Login> readLogins(Context context, byte[] vaultKey) throws Exception {
        List<Login> result = new ArrayList<>();
        List<VaultRecordEntity> records = PasKeyVaultDatabase.get(context)
                .records().findByEntity("VaultItem");
        for (VaultRecordEntity record : records) {
            JSONObject row = new JSONObject(decryptDevice(record.ciphertext, record.iv));
            String type = row.optString("type", "");
            if (!("password".equals(type) || "email".equals(type) || "social".equals(type))) {
                continue;
            }
            String username = firstNonEmpty(row.optString("username", ""), row.optString("email", ""));
            String password = decryptBrowserText(vaultKey, row.optString("password", ""));
            if (username.isEmpty() || password.isEmpty()) continue;
            result.add(new Login(
                    record.recordId,
                    firstNonEmpty(row.optString("title", ""), row.optString("provider", "PasKey login")),
                    username,
                    password,
                    row.optString("website", ""),
                    row.optString("applicationIdentifier", ""),
                    row.optString("updated_date", "")
            ));
        }
        return result;
    }

    public static List<Login> readPending(Context context) throws Exception {
        List<Login> result = new ArrayList<>();
        JSONArray pending = PasKeyAutofillStore.loadPending(context);
        for (int i = 0; i < pending.length(); i++) {
            JSONObject row = pending.optJSONObject(i);
            if (row == null) continue;
            String username = firstNonEmpty(row.optString("username", ""), row.optString("email", ""));
            String password = row.optString("password", "");
            if (username.isEmpty() || password.isEmpty()) continue;
            result.add(new Login(
                    row.optString("_paskeyPendingId", row.optString("pendingId", "pending-" + i)),
                    firstNonEmpty(row.optString("title", ""), row.optString("displayTitle", "PasKey login")),
                    username,
                    password,
                    row.optString("website", ""),
                    row.optString("applicationIdentifier", ""),
                    ""
            ));
        }
        return result;
    }

    private static String decryptDevice(String ciphertextB64, String ivB64) throws Exception {
        Cipher cipher = Cipher.getInstance(DEVICE_TRANSFORMATION);
        cipher.init(
                Cipher.DECRYPT_MODE,
                PasKeyKeyStore.getOrCreateKey(),
                new GCMParameterSpec(128, Base64.decode(ivB64, Base64.NO_WRAP))
        );
        return new String(cipher.doFinal(Base64.decode(ciphertextB64, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    private static String decryptBrowserText(byte[] rawKey, String payload) {
        if (payload == null || !payload.startsWith("v1.")) return "";
        try {
            String[] parts = payload.split("\\.", 3);
            if (parts.length != 3) return "";
            SecretKey key = new SecretKeySpec(rawKey, "AES");
            Cipher cipher = Cipher.getInstance(DEVICE_TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, key,
                    new GCMParameterSpec(128, Base64.decode(parts[1], Base64.NO_WRAP)));
            return new String(cipher.doFinal(Base64.decode(parts[2], Base64.NO_WRAP)), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            return "";
        }
    }

    private static String firstNonEmpty(String first, String second) {
        return first == null || first.isEmpty() ? (second == null ? "" : second) : first;
    }
}
