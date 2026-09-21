package com.paskey.vault.autofill;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import com.paskey.vault.security.PasKeyKeyStore;

import org.json.JSONArray;

import java.nio.charset.StandardCharsets;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

public final class PasKeyAutofillStore {

    private static final String PREFS = "paskey_secure_autofill";
    private static final String KEY_CIPHERTEXT = "vault_ciphertext";
    private static final String KEY_IV = "vault_iv";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";

    private PasKeyAutofillStore() {}

    public static void save(Context context, JSONArray items) throws Exception {
        SecretKey key = PasKeyKeyStore.getOrCreateKey();

        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, key);

        byte[] plaintext =
                items.toString().getBytes(StandardCharsets.UTF_8);

        byte[] ciphertext =
                cipher.doFinal(plaintext);

        SharedPreferences prefs =
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        prefs.edit()
                .putString(
                        KEY_CIPHERTEXT,
                        Base64.encodeToString(ciphertext, Base64.NO_WRAP)
                )
                .putString(
                        KEY_IV,
                        Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
                )
                .apply();
    }

    public static JSONArray load(Context context) throws Exception {
        SharedPreferences prefs =
                context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);

        String ciphertextB64 =
                prefs.getString(KEY_CIPHERTEXT, null);

        String ivB64 =
               prefs.getString(KEY_IV, null);

        if (ciphertextB64 == null || ivB64 == null) {
            return new JSONArray();
        }

        SecretKey key = PasKeyKeyStore.getOrCreateKey();

        Cipher cipher = Cipher.getInstance(TRANSFORMATION);

        cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                new GCMParameterSpec(
                        128,
                        Base64.decode(ivB64, Base64.NO_WRAP)
                )
        );

        byte[] plaintext =
                cipher.doFinal(
                        Base64.decode(
                                ciphertextB64,
                                Base64.NO_WRAP
                        )
                );

        return new JSONArray(
                new String(
                        plaintext,
                        StandardCharsets.UTF_8
                )
        );
    }


    /**
     * Returns the unlocked-vault Autofill cache plus credentials the user has
     * just approved through Android's save UI. Pending saves remain encrypted
     * and become immediately usable for Autofill before they are imported into
     * the main PasKey vault.
     */
    public static JSONArray loadAvailable(Context context) throws Exception {
        JSONArray primary = load(context);
        JSONArray pending = loadPending(context);
        JSONArray available = new JSONArray();

        appendUnique(available, primary);
        appendUnique(available, pending);
        return available;
    }

    private static void appendUnique(JSONArray destination, JSONArray source) {
        for (int i = 0; i < source.length(); i++) {
            org.json.JSONObject candidate = source.optJSONObject(i);
            if (candidate == null || containsEquivalent(destination, candidate)) {
                continue;
            }
            destination.put(candidate);
        }
    }

    private static boolean containsEquivalent(JSONArray items, org.json.JSONObject candidate) {
        boolean candidateCard = "cards".equals(candidate.optString("category", ""));
        String candidateIdentity = firstNonEmpty(
                candidate.optString("email", ""),
                candidate.optString("phone", ""),
                candidate.optString("username", "")
        );

        for (int i = 0; i < items.length(); i++) {
            org.json.JSONObject item = items.optJSONObject(i);
            if (item == null) continue;

            boolean itemCard = "cards".equals(item.optString("category", ""));
            if (candidateCard != itemCard) continue;

            if (candidateCard) {
                if (candidate.optString("cardNumber", "").equals(item.optString("cardNumber", ""))
                        && candidate.optString("expiry", "").equals(item.optString("expiry", ""))
                        && candidate.optString("cardholder", "").equals(item.optString("cardholder", ""))) {
                    return true;
                }
                continue;
            }

            String itemIdentity = firstNonEmpty(
                    item.optString("email", ""),
                    item.optString("phone", ""),
                    item.optString("username", "")
            );

            boolean sameTarget =
                    PasKeyAutofillMatcher.normalizeHost(candidate.optString("website", ""))
                            .equals(PasKeyAutofillMatcher.normalizeHost(item.optString("website", "")))
                    && candidate.optString("applicationIdentifier", "").trim()
                            .equals(item.optString("applicationIdentifier", "").trim());

            if (sameTarget
                    && candidateIdentity.equals(itemIdentity)
                    && candidate.optString("password", "").equals(item.optString("password", ""))) {
                return true;
            }
        }
        return false;
    }

    private static String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }

    public static void savePending(Context context, JSONArray items) throws Exception {
        SecretKey key = PasKeyKeyStore.getOrCreateKey();
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, key);
        byte[] ciphertext = cipher.doFinal(items.toString().getBytes(StandardCharsets.UTF_8));
        boolean saved = context.getSharedPreferences("paskey_pending_autofill", Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_CIPHERTEXT, Base64.encodeToString(ciphertext, Base64.NO_WRAP))
                .putString(KEY_IV, Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
                .commit();
        if (!saved) {
            throw new java.io.IOException("Unable to save pending autofill credentials");
        }
    }

    public static void removePending(Context context, JSONArray pendingIds) throws Exception {
        if (pendingIds.length() == 0) {
            return;
        }

        JSONArray current = loadPending(context);
        JSONArray remaining = new JSONArray();

        for (int i = 0; i < current.length(); i++) {
            org.json.JSONObject item = current.optJSONObject(i);
            boolean shouldRemove = false;

           if (item != null) {
                String itemId = item.optString("_paskeyPendingId", item.optString("pendingId", ""));

                for (int j = 0; j < pendingIds.length(); j++) {
                    if (itemId.equals(pendingIds.optString(j, ""))) {
                        shouldRemove = true;
                        break;
                    }
                }
            }

            if (!shouldRemove) {
                remaining.put(item);
            }
        }

        if (remaining.length() == 0) {
            clearPending(context);
        } else {
            savePending(context, remaining);
        }
    }
    public static JSONArray loadPending(Context context) throws Exception {
        SharedPreferences prefs =
                context.getSharedPreferences("paskey_pending_autofill", Context.MODE_PRIVATE);

        String ciphertextB64 =
                prefs.getString(KEY_CIPHERTEXT, null);

        String ivB64 =
               prefs.getString(KEY_IV, null);

        if (ciphertextB64 == null || ivB64 == null) {
            return new JSONArray();
        }

        SecretKey key = PasKeyKeyStore.getOrCreateKey();

        Cipher cipher = Cipher.getInstance(TRANSFORMATION);

        cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                new GCMParameterSpec(
                        128,
                        Base64.decode(ivB64, Base64.NO_WRAP)
                )
        );

        byte[] plaintext =
                cipher.doFinal(
                        Base64.decode(
                                ciphertextB64,
                                Base64.NO_WRAP
                        )
                );

        return new JSONArray(
                new String(
                        plaintext,
                        StandardCharsets.UTF_8
                )
        );
    }

    public static void clearPending(Context context) {
        context.getSharedPreferences(
                "paskey_pending_autofill",
                Context.MODE_PRIVATE
        ).edit().remove(KEY_CIPHERTEXT).remove(KEY_IV).commit();
    }

    public static void clear(Context context) {
        context.getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
        ).edit().clear().apply();
    }

    public static boolean hasData(Context context) {
        return context.getSharedPreferences(
                PREFS,
                Context.MODE_PRIVATE
        ).contains(KEY_CIPHERTEXT);
    }
}
