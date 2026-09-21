package com.paskey.vault.autofill;

import android.app.PendingIntent;
import android.app.assist.AssistStructure;
import android.app.slice.Slice;
import android.graphics.drawable.Icon;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.os.CancellationSignal;
import android.service.autofill.AutofillService;
import android.service.autofill.Dataset;
import android.service.autofill.FillCallback;
import android.service.autofill.FillContext;
import android.service.autofill.FillRequest;
import android.service.autofill.FillResponse;
import android.service.autofill.InlinePresentation;
import android.service.autofill.SaveCallback;
import android.service.autofill.SaveInfo;
import android.service.autofill.SaveRequest;
import android.text.InputType;
import android.util.Base64;
import android.util.Pair;
import android.view.ViewStructure;
import android.view.autofill.AutofillId;
import android.view.autofill.AutofillValue;
import android.view.inputmethod.InlineSuggestionsRequest;
import android.widget.inline.InlinePresentationSpec;
import android.widget.RemoteViews;

import androidx.annotation.RequiresApi;
import androidx.autofill.inline.UiVersions;
import androidx.autofill.inline.v1.InlineSuggestionUi;

import com.paskey.vault.MainActivity;
import com.paskey.vault.R;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Android Autofill service for PasKey.
 *
 * Saved entries are only offered when their exact saved web-domain or Android
 * package matches the target. A manual selector is shown only when the user
 * explicitly taps the PasKey choice. Every selected entry launches
 * AutofillAuthActivity, which asks Android BiometricPrompt before values leave
 * PasKey's encrypted native cache.
 */
public class PasKeyAutofillService extends AutofillService {

    private static final int FIELD_IGNORED = -1;
    private static final int FIELD_NONE = 0;
    private static final int FIELD_EMAIL = 1;
    private static final int FIELD_PHONE = 2;
    private static final int FIELD_USERNAME = 3;
    private static final int FIELD_PASSWORD = 4;

    private AutofillId emailId;
    private AutofillId usernameId;
    private AutofillId passwordId;
    private AutofillId phoneId;
    private AutofillId cardholderId;
    private AutofillId cardNumberId;
    private AutofillId cardExpiryId;
    private AutofillId cardCvvId;
    private String targetPackage = "";
    private String targetWebDomain = "";

    @Override
    public void onFillRequest(
            FillRequest request,
            CancellationSignal cancellationSignal,
            FillCallback callback) {
        if (request.getFillContexts() == null || request.getFillContexts().isEmpty()) {
            callback.onSuccess(null);
            return;
        }

        inspectContexts(request.getFillContexts());

        boolean loginForm = hasLoginFields();
        boolean cardForm = !loginForm && hasCardFields();
        if (!loginForm && !cardForm) {
            callback.onSuccess(null);
            return;
        }

        JSONArray items;
        try {
            items = PasKeyAutofillStore.loadAvailable(this);
        } catch (Exception ignored) {
            callback.onSuccess(buildSaveOnlyResponse());
            return;
        }

        FillResponse.Builder response = new FillResponse.Builder();
        int datasetCount = 0;
        String selectorMode = cardForm ? "cards" : "logins";

        for (int index = 0; index < items.length(); index++) {
            JSONObject item = items.optJSONObject(index);
            if (item == null) continue;

            boolean itemIsCard = "cards".equals(item.optString("category", ""));
            if (cardForm) {
                if (!itemIsCard) continue;
                Dataset dataset = buildAuthenticatedDataset(item, index, selectorMode, request, datasetCount);
                if (dataset != null) {
                    response.addDataset(dataset);
                    datasetCount++;
                }
                continue;
            }

            if (itemIsCard) continue;
            int score = PasKeyAutofillMatcher.score(
                    item.optString("website", ""),
                    item.optString("applicationIdentifier", ""),
                    targetWebDomain,
                    targetPackage
            );
            if (score <= 0) continue;

            Dataset dataset = buildAuthenticatedDataset(item, index, selectorMode, request, datasetCount);
            if (dataset != null) {
                response.addDataset(dataset);
                datasetCount++;
            }
        }

        // This is not an automatic spillover: Android presents one explicit
        // PasKey option only when no saved record matches the current target.
        if (datasetCount == 0 && hasSelectableRecords(items, selectorMode)) {
            Dataset picker = buildManualPickerDataset(selectorMode, request, datasetCount);
            if (picker != null) {
                response.addDataset(picker);
                datasetCount++;
            }
        }

        SaveInfo saveInfo = buildSaveInfo();
        if (saveInfo != null) response.setSaveInfo(saveInfo);
        callback.onSuccess(datasetCount == 0 && saveInfo == null ? null : response.build());
    }

    private void inspectContexts(List<FillContext> contexts) {
        resetFieldState();
        if (contexts == null) return;
        for (FillContext context : contexts) {
            if (context != null) inspectStructure(context.getStructure());
        }
    }

    private void inspectStructure(AssistStructure structure) {
        if (structure == null) return;
        if (structure.getActivityComponent() != null) {
            targetPackage = structure.getActivityComponent().getPackageName();
        }
        for (int i = 0; i < structure.getWindowNodeCount(); i++) {
            findFields(structure.getWindowNodeAt(i).getRootViewNode());
        }
    }

    private void resetFieldState() {
        emailId = null;
        usernameId = null;
        passwordId = null;
        phoneId = null;
        cardholderId = null;
        cardNumberId = null;
        cardExpiryId = null;
        cardCvvId = null;
        targetPackage = "";
        targetWebDomain = "";
    }

    private boolean hasLoginFields() {
        return emailId != null || usernameId != null || passwordId != null || phoneId != null;
    }

    private boolean hasCardFields() {
        return cardholderId != null || cardNumberId != null || cardExpiryId != null || cardCvvId != null;
    }

    private RemoteViews presentationFor(JSONObject item) {
        String title = item.optString("displayTitle", item.optString("title", "PasKey"));
        if (title.trim().isEmpty()) title = "PasKey";
        String subtitle = item.optString("displaySubtitle", "");
        if (subtitle.trim().isEmpty()) {
            subtitle = item.optString("email", item.optString("username", ""));
        }
        if (subtitle.trim().isEmpty()) {
            subtitle = item.optString("website", item.optString("applicationIdentifier", "Saved login"));
        }
        RemoteViews presentation = presentationFor(title, subtitle);
        applyPresentationImage(presentation, item.optString("image", ""));
        return presentation;
    }

    private RemoteViews presentationFor(String title, String subtitle) {
        RemoteViews presentation = new RemoteViews(getPackageName(), R.layout.paskey_autofill_presentation);
        presentation.setTextViewText(R.id.paskey_autofill_title, title);
        presentation.setTextViewText(R.id.paskey_autofill_subtitle, subtitle);
        presentation.setImageViewResource(R.id.paskey_autofill_icon, R.mipmap.ic_launcher);
        return presentation;
    }

    private void applyPresentationImage(RemoteViews presentation, String image) {
        if (image == null || !image.startsWith("data:image/")) return;
        int comma = image.indexOf(',');
        if (comma < 0 || comma + 1 >= image.length()) return;
        try {
            byte[] bytes = Base64.decode(image.substring(comma + 1), Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap != null) presentation.setImageViewBitmap(R.id.paskey_autofill_icon, bitmap);
        } catch (Exception ignored) {
            // The PasKey icon remains visible if a local image cannot be decoded.
        }
    }

    @SuppressWarnings("deprecation")
    private Dataset buildAuthenticatedDataset(JSONObject item, int itemIndex, String selectorMode, FillRequest request, int inlineIndex) {
        RemoteViews presentation = presentationFor(item);
        Intent intent = buildAuthenticationIntent(itemIndex, selectorMode, false);
        PendingIntent pendingIntent = authenticationPendingIntent(intent, 10000 + itemIndex);

        // Dataset.Builder(RemoteViews) + setAuthentication(IntentSender) is
        // compatible with Android API 26+. Do not use the unavailable two-arg
        // setAuthentication(IntentSender, RemoteViews) overload.
        Dataset.Builder dataset = new Dataset.Builder(presentation);
        dataset.setAuthentication(pendingIntent.getIntentSender());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            InlineSupport.applyItem(this, dataset, request, item, inlineIndex);
        }

        boolean hasField = false;
        boolean card = "cards".equals(item.optString("category", ""));
        if (card) {
            hasField |= associate(dataset, cardholderId, presentation);
            hasField |= associate(dataset, cardNumberId, presentation);
            hasField |= associate(dataset, cardExpiryId, presentation);
            hasField |= associate(dataset, cardCvvId, presentation);
        } else {
            if (!isCompleteLoginRecord(item)) return null;
            if (!item.optString("email", "").isEmpty()) hasField |= associate(dataset, emailId, presentation);
            if (!item.optString("username", "").isEmpty()) hasField |= associate(dataset, usernameId, presentation);
            if (!item.optString("phone", "").isEmpty()) hasField |= associate(dataset, phoneId, presentation);
            hasField |= associate(dataset, passwordId, presentation);
        }
        return hasField ? dataset.build() : null;
    }

    @SuppressWarnings("deprecation")
    private Dataset buildManualPickerDataset(String selectorMode, FillRequest request, int inlineIndex) {
        String description = "cards".equals(selectorMode)
                ? "Choose a saved card"
                : "Choose a saved login";
        RemoteViews presentation = presentationFor("Search PasKey", description);
        Intent intent = buildAuthenticationIntent(-1, selectorMode, true);
        PendingIntent pendingIntent = authenticationPendingIntent(intent, 20000 + selectorMode.hashCode());
        Dataset.Builder dataset = new Dataset.Builder(presentation);
        dataset.setAuthentication(pendingIntent.getIntentSender());

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            InlineSupport.applyText(
                    this,
                    dataset,
                    request,
                    "Search PasKey",
                    description,
                    inlineIndex,
                    42000 + Math.abs(selectorMode.hashCode() % 1000)
            );
        }

        boolean hasField = false;
        if ("cards".equals(selectorMode)) {
            hasField |= associate(dataset, cardholderId, presentation);
            hasField |= associate(dataset, cardNumberId, presentation);
            hasField |= associate(dataset, cardExpiryId, presentation);
            hasField |= associate(dataset, cardCvvId, presentation);
        } else {
            hasField |= associate(dataset, emailId, presentation);
            hasField |= associate(dataset, usernameId, presentation);
            hasField |= associate(dataset, phoneId, presentation);
            hasField |= associate(dataset, passwordId, presentation);
        }
        return hasField ? dataset.build() : null;
    }

    private Intent buildAuthenticationIntent(int itemIndex, String selectorMode, boolean manualPicker) {
        Intent intent = new Intent(this, AutofillAuthActivity.class);
        intent.putExtra("itemIndex", itemIndex);
        intent.putExtra("selectorMode", selectorMode);
        intent.putExtra("manualPicker", manualPicker);
        putFieldIds(intent);
        return intent;
    }

    private PendingIntent authenticationPendingIntent(Intent intent, int requestCode) {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) flags |= PendingIntent.FLAG_MUTABLE;
        return PendingIntent.getActivity(this, requestCode, intent, flags);
    }

    private boolean associate(Dataset.Builder dataset, AutofillId id, RemoteViews presentation) {
        if (id == null) return false;
        // Null means the authentication Activity supplies the value after the
        // biometric check. The field association makes the locked dataset
        // eligible for this request without placing a secret in the response.
        dataset.setValue(id, null, presentation);
        return true;
    }


    private PendingIntent attributionPendingIntent(int requestCode) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(this, requestCode, intent, flags);
    }

    /**
     * Android 11+ inline Autofill UI is isolated in its own class so devices
     * below API 30 never resolve inline-only framework classes.
     */
    @RequiresApi(api = Build.VERSION_CODES.R)
    private static final class InlineSupport {
        private InlineSupport() {}

        static void applyItem(
                PasKeyAutofillService service,
                Dataset.Builder dataset,
                FillRequest request,
                JSONObject item,
                int inlineIndex) {

            String title = item.optString("displayTitle", item.optString("title", "PasKey"));
            if (title.trim().isEmpty()) title = "PasKey";

            String subtitle = item.optString("displaySubtitle", "");
            if (subtitle.trim().isEmpty()) {
                subtitle = item.optString(
                        "email",
                        item.optString(
                                "username",
                                item.optString(
                                        "phone",
                                        item.optString(
                                                "website",
                                                item.optString("applicationIdentifier", "Saved login")
                                        )
                                )
                        )
                );
            }

            applyText(
                    service,
                    dataset,
                    request,
                    title,
                    subtitle,
                    inlineIndex,
                    41000 + (inlineIndex % 1000)
            );
        }

        static void applyText(
                PasKeyAutofillService service,
                Dataset.Builder dataset,
                FillRequest request,
                String title,
                String subtitle,
                int inlineIndex,
                int attributionRequestCode) {
            try {
                InlineSuggestionsRequest inlineRequest = request.getInlineSuggestionsRequest();
                if (inlineRequest == null) return;

                int max = inlineRequest.getMaxSuggestionCount();
                if (max != InlineSuggestionsRequest.SUGGESTION_COUNT_UNLIMITED
                        && (max <= 0 || inlineIndex >= max)) {
                    return;
                }

                List<InlinePresentationSpec> specs = inlineRequest.getInlinePresentationSpecs();
                if (specs == null || specs.isEmpty()) return;

                InlinePresentationSpec spec =
                        specs.get(Math.min(inlineIndex, specs.size() - 1));

                if (!UiVersions.getVersions(spec.getStyle())
                        .contains(UiVersions.INLINE_UI_VERSION_1)) {
                    return;
                }

                PendingIntent attribution =
                        service.attributionPendingIntent(attributionRequestCode);

                InlineSuggestionUi.Content.Builder content =
                        InlineSuggestionUi.newContentBuilder(attribution)
                                .setContentDescription(
                                        subtitle == null || subtitle.trim().isEmpty()
                                                ? title
                                                : title + ", " + subtitle
                                )
                                .setTitle(title);

                if (subtitle != null && !subtitle.trim().isEmpty()) {
                    content.setSubtitle(subtitle);
                }

                Icon icon = Icon.createWithResource(service, R.mipmap.ic_launcher);
                content.setStartIcon(icon);

                Slice slice = content.build().getSlice();
                dataset.setInlinePresentation(new InlinePresentation(slice, spec, false));
            } catch (Exception ignored) {
                // If an IME does not support the standard inline template,
                // Android falls back to the normal Autofill menu presentation.
            }
        }
    }

    private void putFieldIds(Intent intent) {
        intent.putExtra("emailId", emailId);
        intent.putExtra("usernameId", usernameId);
        intent.putExtra("passwordId", passwordId);
        intent.putExtra("phoneId", phoneId);
        intent.putExtra("cardholderId", cardholderId);
        intent.putExtra("cardNumberId", cardNumberId);
        intent.putExtra("cardExpiryId", cardExpiryId);
        intent.putExtra("cardCvvId", cardCvvId);
    }

    private boolean hasSelectableRecords(JSONArray items, String selectorMode) {
        for (int i = 0; i < items.length(); i++) {
            JSONObject item = items.optJSONObject(i);
            if (item == null) continue;
            boolean card = "cards".equals(item.optString("category", ""));
            if (("cards".equals(selectorMode)) != card) continue;
            if (card) {
                if (!item.optString("cardNumber", "").isEmpty()) return true;
            } else if (isCompleteLoginRecord(item)) {
                return true;
            }
        }
        return false;
    }

    private SaveInfo buildSaveInfo() {
        AutofillId identityId = emailId != null ? emailId : (phoneId != null ? phoneId : usernameId);
        if (identityId == null || passwordId == null) return null;
        SaveInfo.Builder builder = new SaveInfo.Builder(
                SaveInfo.SAVE_DATA_TYPE_USERNAME | SaveInfo.SAVE_DATA_TYPE_PASSWORD,
                new AutofillId[] { identityId, passwordId }
        );
        return builder.build();
    }

    private FillResponse buildSaveOnlyResponse() {
        SaveInfo saveInfo = buildSaveInfo();
        return saveInfo == null ? null : new FillResponse.Builder().setSaveInfo(saveInfo).build();
    }

    private void findFields(AssistStructure.ViewNode node) {
        if (node == null) return;
        AutofillId id = node.getAutofillId();
        String webDomain = node.getWebDomain();
        if (webDomain != null && !webDomain.trim().isEmpty()) {
            targetWebDomain = webDomain.trim().toLowerCase(Locale.ROOT);
        }

        if (id != null) {
            StringBuilder text = new StringBuilder();
            append(text, node.getHint());
            append(text, node.getIdEntry());
            if (node.getText() != null) append(text, node.getText().toString());
            String[] officialHints = node.getAutofillHints();
            if (officialHints != null) for (String hint : officialHints) append(text, hint);
            if (node.getHtmlInfo() != null) {
                ViewStructure.HtmlInfo htmlInfo = node.getHtmlInfo();
                append(text, htmlInfo.getTag());
                List<Pair<String, String>> attributes = htmlInfo.getAttributes();
                if (attributes != null) {
                    for (Pair<String, String> attribute : attributes) {
                        append(text, attribute.first);
                        append(text, attribute.second);
                    }
                }
            }

            int inputType = node.getInputType();
            int inputClass = inputType & InputType.TYPE_MASK_CLASS;
            int inputVariation = inputType & InputType.TYPE_MASK_VARIATION;
            if (inputClass == InputType.TYPE_CLASS_PHONE) append(text, "phone");
            if (inputVariation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                    || inputVariation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) append(text, "email");
            if (inputVariation == InputType.TYPE_TEXT_VARIATION_PASSWORD
                    || inputVariation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                    || inputVariation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
                    || inputVariation == InputType.TYPE_NUMBER_VARIATION_PASSWORD) append(text, "password");

            String value = text.toString().toLowerCase(Locale.ROOT);
            int fieldType = classifyField(officialHints, value);
            if (cardNumberId == null && containsAny(value, "creditcardnumber", "credit_card_number", "cardnumber", "card_number", "cc-number", "cc_number")) {
                cardNumberId = id;
            } else if (cardExpiryId == null && containsAny(value, "cc-exp", "expiry", "expiration", "exp-date", "exp_date", "mm/yy", "mm/yyyy")) {
                cardExpiryId = id;
            } else if (cardCvvId == null && containsAny(value, "cvv", "cvc", "securitycode", "security_code", "cc-csc")) {
                cardCvvId = id;
            } else if (cardholderId == null && containsAny(value, "cardholder", "card_holder", "nameoncard", "name_on_card", "cc-name")) {
                cardholderId = id;
            } else if (passwordId == null && fieldType == FIELD_PASSWORD) {
                passwordId = id;
            } else if (emailId == null && fieldType == FIELD_EMAIL) {
                emailId = id;
            } else if (phoneId == null && fieldType == FIELD_PHONE) {
                phoneId = id;
            } else if (usernameId == null && fieldType == FIELD_USERNAME) {
                usernameId = id;
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) findFields(node.getChildAt(i));
    }

    private void append(StringBuilder text, String value) {
        if (value != null && !value.isEmpty()) text.append(' ').append(value);
    }

    private int classifyField(String[] officialHints, String fallbackText) {
        if (officialHints != null) {
            for (String hint : officialHints) {
                String normalized = normalizeHint(hint);
                if (containsAny(normalized, "otp", "onetimecode", "smscode", "verificationcode")) {
                    return FIELD_IGNORED;
                }
            }
            for (String hint : officialHints) {
                String normalized = normalizeHint(hint);
                if (containsAny(normalized, "emailaddress", "email")) return FIELD_EMAIL;
                if (containsAny(normalized, "phonenumber", "phone", "telephone", "mobile")) return FIELD_PHONE;
                if (containsAny(normalized, "username", "userid")) return FIELD_USERNAME;
                if (containsAny(normalized, "password")) return FIELD_PASSWORD;
            }
        }

        String value = fallbackText == null ? "" : fallbackText.toLowerCase(Locale.ROOT);
        if (containsAny(value, "one-time", "one_time", "onetime", "otp", "sms code", "sms_code", "verification code", "verification_code", "2fa")) {
            return FIELD_IGNORED;
        }
        if (containsAny(value, "email", "e-mail")) return FIELD_EMAIL;
        if (containsAny(value, "phone", "telephone", "mobile", "phone_number", "phonenumber")) return FIELD_PHONE;
        if (containsAny(value, "password", "passwd", "passcode", "login_pin", "login pin")) return FIELD_PASSWORD;
        if (containsAny(value, "username", "user name", "login", "userid", "user_id", "customerid", "customer_id", "accountid", "account_id")) {
            return FIELD_USERNAME;
        }
        return FIELD_NONE;
    }

    private String normalizeHint(String value) {
        return value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private boolean containsAny(String value, String... terms) {
        for (String term : terms) if (value.contains(term)) return true;
        return false;
    }

    private String getFieldText(AssistStructure.ViewNode node, AutofillId targetId) {
        if (node == null || targetId == null) return "";
        if (targetId.equals(node.getAutofillId())) {
            AutofillValue value = node.getAutofillValue();
            if (value != null && value.isText() && value.getTextValue() != null) {
                return value.getTextValue().toString();
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            String value = getFieldText(node.getChildAt(i), targetId);
            if (!value.isEmpty()) return value;
        }
        return "";
    }

    @Override
    public void onSaveRequest(SaveRequest request, SaveCallback callback) {
        try {
            if (request.getFillContexts() == null || request.getFillContexts().isEmpty()) {
                callback.onSuccess();
                return;
            }

            CapturedLogin captured = new CapturedLogin();
            for (FillContext context : request.getFillContexts()) {
                if (context != null) captureLogin(context.getStructure(), captured);
            }

            String identity = captured.identity();
            String website = PasKeyAutofillMatcher.normalizeHost(captured.website);
            String applicationIdentifier = website.isEmpty() ? captured.applicationIdentifier.trim() : "";
            if (identity.isEmpty() || captured.password.trim().isEmpty()
                    || (website.isEmpty() && applicationIdentifier.isEmpty())) {
                callback.onSuccess();
                return;
            }

            JSONArray pending = PasKeyAutofillStore.loadPending(this);
            if (!containsPending(pending, website, applicationIdentifier, identity, captured.password)) {
                String pendingId = UUID.randomUUID().toString();
                JSONObject entry = new JSONObject();
                entry.put("title", buildLoginTitle(website, applicationIdentifier, identity));
                entry.put("website", website);
                entry.put("applicationIdentifier", applicationIdentifier);
                entry.put("username", captured.username);
                entry.put("email", captured.email);
                entry.put("phone", captured.phone);
                entry.put("password", captured.password);
                entry.put("image", "");
                entry.put("_paskeyPendingId", pendingId);
                pending.put(entry);
                PasKeyAutofillStore.savePending(this, pending);
            }
        } catch (Exception ignored) {
            // Saving must never interrupt the requesting website or app.
        }
        callback.onSuccess();
    }

    private boolean containsPending(JSONArray pending, String webDomain, String packageName, String identity, String password) {
        for (int i = 0; i < pending.length(); i++) {
            JSONObject item = pending.optJSONObject(i);
            if (item == null) continue;
            String itemIdentity = firstNonEmpty(
                    item.optString("email", ""),
                    item.optString("phone", ""),
                    item.optString("username", "")
            );
            if (webDomain.equals(PasKeyAutofillMatcher.normalizeHost(item.optString("website", "")))
                    && packageName.equals(item.optString("applicationIdentifier", "").trim())
                    && identity.equals(itemIdentity)
                    && password.equals(item.optString("password", ""))) {
                return true;
            }
        }
        return false;
    }

    private void captureLogin(AssistStructure structure, CapturedLogin captured) {
        if (structure == null) return;
        if (structure.getActivityComponent() != null && captured.applicationIdentifier.isEmpty()) {
            captured.applicationIdentifier = structure.getActivityComponent().getPackageName();
        }
        for (int i = 0; i < structure.getWindowNodeCount(); i++) {
            captureLoginNode(structure.getWindowNodeAt(i).getRootViewNode(), captured);
        }
    }

    private void captureLoginNode(AssistStructure.ViewNode node, CapturedLogin captured) {
        if (node == null) return;
        String webDomain = PasKeyAutofillMatcher.normalizeHost(node.getWebDomain());
        if (!webDomain.isEmpty()) captured.website = webDomain;

        StringBuilder metadata = new StringBuilder();
        append(metadata, node.getHint());
        append(metadata, node.getIdEntry());
        if (node.getText() != null) append(metadata, node.getText().toString());
        if (node.getHtmlInfo() != null) {
            ViewStructure.HtmlInfo htmlInfo = node.getHtmlInfo();
            append(metadata, htmlInfo.getTag());
            List<Pair<String, String>> attributes = htmlInfo.getAttributes();
            if (attributes != null) {
                for (Pair<String, String> attribute : attributes) {
                    append(metadata, attribute.first);
                    append(metadata, attribute.second);
                }
            }
        }
        int inputType = node.getInputType();
        int inputClass = inputType & InputType.TYPE_MASK_CLASS;
        int inputVariation = inputType & InputType.TYPE_MASK_VARIATION;
        if (inputClass == InputType.TYPE_CLASS_PHONE) append(metadata, "phone");
        if (inputVariation == InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
                || inputVariation == InputType.TYPE_TEXT_VARIATION_WEB_EMAIL_ADDRESS) append(metadata, "email");
        if (inputVariation == InputType.TYPE_TEXT_VARIATION_PASSWORD
                || inputVariation == InputType.TYPE_TEXT_VARIATION_VISIBLE_PASSWORD
                || inputVariation == InputType.TYPE_TEXT_VARIATION_WEB_PASSWORD
                || inputVariation == InputType.TYPE_NUMBER_VARIATION_PASSWORD) append(metadata, "password");

        String value = fieldText(node);
        if (!value.isEmpty()) {
            switch (classifyField(node.getAutofillHints(), metadata.toString())) {
                case FIELD_EMAIL:
                    captured.email = value.trim();
                    break;
                case FIELD_PHONE:
                    captured.phone = value.trim();
                    break;
                case FIELD_USERNAME:
                    captured.username = value.trim();
                    break;
                case FIELD_PASSWORD:
                    captured.password = value;
                    break;
                default:
                    break;
            }
        }
        for (int i = 0; i < node.getChildCount(); i++) captureLoginNode(node.getChildAt(i), captured);
    }

    private String fieldText(AssistStructure.ViewNode node) {
        AutofillValue value = node.getAutofillValue();
        if (value != null && value.isText() && value.getTextValue() != null) {
            return value.getTextValue().toString();
        }
        return "";
    }

    private boolean isCompleteLoginRecord(JSONObject item) {
        if (item == null || item.optString("password", "").trim().isEmpty()) return false;
        String identity = firstNonEmpty(
                item.optString("email", ""),
                item.optString("phone", ""),
                item.optString("username", "")
        );
        if (identity.isEmpty()) return false;
        String website = PasKeyAutofillMatcher.normalizeHost(item.optString("website", ""));
        String applicationIdentifier = item.optString("applicationIdentifier", "").trim();
        return !website.isEmpty() || !applicationIdentifier.isEmpty();
    }

    private String firstNonEmpty(String... values) {
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) return value.trim();
        }
        return "";
    }

    private String buildLoginTitle(String website, String applicationIdentifier, String identity) {
        String service = "Website";
        if ("accounts.google.com".equals(website)) service = "Google";
        else if ("com.instagram.android".equals(applicationIdentifier)) service = "Instagram";
        else if ("com.whatsapp".equals(applicationIdentifier)) service = "WhatsApp";
        else if (website.isEmpty()) service = "Android app";
        return service + " — " + identity;
    }

    private static final class CapturedLogin {
        String email = "";
        String phone = "";
        String username = "";
        String password = "";
        String website = "";
        String applicationIdentifier = "";

        String identity() {
            if (!email.trim().isEmpty()) return email.trim();
            if (!phone.trim().isEmpty()) return phone.trim();
            return username.trim();
        }
    }
}
