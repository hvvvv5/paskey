package com.paskey.vault.autofill;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.view.WindowManager;
import android.service.autofill.Dataset;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillManager;
import android.view.autofill.AutofillValue;
import android.widget.RemoteViews;

import androidx.annotation.Nullable;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.concurrent.Executor;

/** Authentication activity used by both matching datasets and manual picking. */
public class AutofillAuthActivity extends FragmentActivity {

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // The authentication picker can briefly hold decrypted values; keep
        // it out of screenshots and the recent-task preview as well.
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
        authenticate();
    }

    private void authenticate() {
        Executor executor = ContextCompat.getMainExecutor(this);
        BiometricPrompt prompt = new BiometricPrompt(this, executor,
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        if (getIntent().getBooleanExtra("manualPicker", false)) showPicker();
                        else returnAuthenticatedDataset(getIntent().getIntExtra("itemIndex", -1));
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, CharSequence errorText) {
                        cancel();
                    }
                });
        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Unlock PasKey")
                .setSubtitle("Verify your identity to autofill")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .setNegativeButtonText("Cancel")
                .build();
        prompt.authenticate(promptInfo);
    }

    private void showPicker() {
        try {
            JSONArray items = PasKeyAutofillStore.loadAvailable(this);
            boolean cards = "cards".equals(getIntent().getStringExtra("selectorMode"));
            ArrayList<Integer> indexes = new ArrayList<>();
            ArrayList<String> labels = new ArrayList<>();

            for (int index = 0; index < items.length(); index++) {
                JSONObject item = items.optJSONObject(index);
                if (item == null) continue;
                boolean itemIsCard = "cards".equals(item.optString("category", ""));
                if (itemIsCard != cards || !hasFillValue(item, cards)) continue;

                String title = item.optString("displayTitle", item.optString("title", "PasKey"));
                String subtitle = item.optString("displaySubtitle", "");
                if (subtitle.isEmpty()) {
                    subtitle = item.optString("email", item.optString("username", item.optString("phone", item.optString("website", item.optString("applicationIdentifier", "")))));
                }
                labels.add(subtitle.isEmpty() ? title : title + "\n" + subtitle);
                indexes.add(index);
            }

            if (indexes.isEmpty()) {
                cancel();
                return;
            }

            new AlertDialog.Builder(this)
                    .setTitle(cards ? "Choose a saved card" : "Choose a saved login")
                    .setItems(labels.toArray(new String[0]), (dialog, which) -> returnAuthenticatedDataset(indexes.get(which)))
                    .setNegativeButton("Cancel", (dialog, which) -> cancel())
                    .setOnCancelListener(dialog -> cancel())
                    .show();
        } catch (Exception ignored) {
            cancel();
        }
    }

    private boolean hasFillValue(JSONObject item, boolean cards) {
        if (cards) return !item.optString("cardNumber", "").isEmpty();
        boolean hasIdentity = !item.optString("email", "").trim().isEmpty()
                || !item.optString("phone", "").trim().isEmpty()
                || !item.optString("username", "").trim().isEmpty();
        boolean hasTarget = !PasKeyAutofillMatcher.normalizeHost(item.optString("website", "")).isEmpty()
                || !item.optString("applicationIdentifier", "").trim().isEmpty();
        return hasIdentity && hasTarget && !item.optString("password", "").trim().isEmpty();
    }

    @SuppressWarnings("deprecation")
    private void returnAuthenticatedDataset(int itemIndex) {
        try {
            Intent source = getIntent();
            AutofillId emailId = source.getParcelableExtra("emailId");
            AutofillId usernameId = source.getParcelableExtra("usernameId");
            AutofillId passwordId = source.getParcelableExtra("passwordId");
            AutofillId phoneId = source.getParcelableExtra("phoneId");
            AutofillId cardholderId = source.getParcelableExtra("cardholderId");
            AutofillId cardNumberId = source.getParcelableExtra("cardNumberId");
            AutofillId cardExpiryId = source.getParcelableExtra("cardExpiryId");
            AutofillId cardCvvId = source.getParcelableExtra("cardCvvId");

            JSONArray items = PasKeyAutofillStore.loadAvailable(this);
            JSONObject item = itemIndex >= 0 && itemIndex < items.length() ? items.optJSONObject(itemIndex) : null;
            if (item == null) {
                cancel();
                return;
            }

            String title = item.optString("displayTitle", item.optString("title", "PasKey"));
            String subtitle = item.optString("displaySubtitle", item.optString("email", item.optString("username", "")));
            RemoteViews presentation = new RemoteViews(getPackageName(), android.R.layout.simple_list_item_2);
            presentation.setTextViewText(android.R.id.text1, title.isEmpty() ? "PasKey" : title);
            presentation.setTextViewText(android.R.id.text2, subtitle);

            Dataset.Builder dataset = new Dataset.Builder();
            boolean hasValue = false;
            if ("cards".equals(item.optString("category", ""))) {
                hasValue |= setValue(dataset, cardholderId, item.optString("cardholder", ""), presentation);
                hasValue |= setValue(dataset, cardNumberId, item.optString("cardNumber", ""), presentation);
                hasValue |= setValue(dataset, cardExpiryId, item.optString("expiry", ""), presentation);
                hasValue |= setValue(dataset, cardCvvId, item.optString("cvv", ""), presentation);
            } else {
                hasValue |= setValue(dataset, emailId, item.optString("email", ""), presentation);
                hasValue |= setValue(dataset, usernameId, item.optString("username", ""), presentation);
                hasValue |= setValue(dataset, phoneId, item.optString("phone", ""), presentation);
                hasValue |= setValue(dataset, passwordId, item.optString("password", ""), presentation);
            }

            if (!hasValue) {
                cancel();
                return;
            }

            Intent result = new Intent();
            result.putExtra(AutofillManager.EXTRA_AUTHENTICATION_RESULT, dataset.build());
            Bundle clientState = source.getBundleExtra(AutofillManager.EXTRA_CLIENT_STATE);
            if (clientState != null) {
                result.putExtra(AutofillManager.EXTRA_CLIENT_STATE, clientState);
            }
            setResult(Activity.RESULT_OK, result);
            finish();
        } catch (Exception ignored) {
            cancel();
        }
    }

    private boolean setValue(Dataset.Builder dataset, AutofillId id, String value, RemoteViews presentation) {
        if (id == null || value == null || value.isEmpty()) return false;
        dataset.setValue(id, AutofillValue.forText(value), presentation);
        return true;
    }

    private void cancel() {
        setResult(Activity.RESULT_CANCELED);
        finish();
    }
}
