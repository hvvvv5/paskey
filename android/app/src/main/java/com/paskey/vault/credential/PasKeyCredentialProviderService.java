package com.paskey.vault.credential;

import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.OutcomeReceiver;

import androidx.credentials.provider.AuthenticationAction;
import androidx.credentials.provider.BeginCreateCredentialRequest;
import androidx.credentials.provider.BeginCreateCredentialResponse;
import androidx.credentials.provider.BeginGetCredentialRequest;
import androidx.credentials.provider.BeginGetCredentialResponse;
import androidx.credentials.provider.CredentialEntry;
import androidx.credentials.provider.CredentialProviderService;
import androidx.credentials.provider.CreateEntry;
import androidx.credentials.provider.ProviderClearCredentialStateRequest;
import androidx.credentials.provider.BeginCreatePasswordCredentialRequest;
import androidx.credentials.provider.BeginGetPasswordOption;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.CreateCredentialException;
import androidx.credentials.exceptions.CreateCredentialNoCreateOptionException;
import androidx.credentials.exceptions.GetCredentialException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Android 14+ Credential Manager provider. AutofillService remains the legacy path. */
public final class PasKeyCredentialProviderService extends CredentialProviderService {

    private static final int REQUEST_UNLOCK = 7101;
    private static final int REQUEST_CREATE = 7102;

    @Override
    public void onBeginGetCredentialRequest(
            BeginGetCredentialRequest request,
            CancellationSignal cancellationSignal,
            OutcomeReceiver<BeginGetCredentialResponse, GetCredentialException> callback) {
        if (cancellationSignal.isCanceled() || !hasPasswordOption(request)) {
            callback.onResult(new BeginGetCredentialResponse());
            return;
        }
        if (!CredentialProviderSecurity.hasBiometricWrapper(this)) {
            // A locked vault without an enrolled strong biometric remains available
            // through the app Master Password and legacy Autofill; do not expose data.
            callback.onResult(new BeginGetCredentialResponse());
            return;
        }
        PendingIntent pendingIntent = pendingIntent(PasKeyCredentialActivity.MODE_BEGIN_GET, REQUEST_UNLOCK);
        List<AuthenticationAction> actions = Collections.singletonList(
                new AuthenticationAction("Unlock PasKey", pendingIntent));
        callback.onResult(new BeginGetCredentialResponse(
                Collections.<CredentialEntry>emptyList(),
                Collections.emptyList(),
                actions,
                null
        ));
    }

    @Override
    public void onBeginCreateCredentialRequest(
            BeginCreateCredentialRequest request,
            CancellationSignal cancellationSignal,
            OutcomeReceiver<BeginCreateCredentialResponse, CreateCredentialException> callback) {
        if (cancellationSignal.isCanceled()) {
            callback.onError(new CreateCredentialNoCreateOptionException("Request cancelled"));
            return;
        }
        if (!(request instanceof BeginCreatePasswordCredentialRequest)
                || !CredentialProviderSecurity.hasBiometricWrapper(this)) {
            // Passkeys are intentionally not advertised until WebAuthn validation,
            // attestation and RP association are available. Returning no option
            // lets the system continue with another provider.
            callback.onError(new CreateCredentialNoCreateOptionException(
                    "PasKey does not support this credential type on this device."));
            return;
        }
        PendingIntent pendingIntent = pendingIntent(PasKeyCredentialActivity.MODE_CREATE, REQUEST_CREATE);
        CreateEntry entry = new CreateEntry(
                "PasKey",
                pendingIntent,
                "Save in your encrypted PasKey vault",
                Instant.now(),
                null,
                1,
                0,
                1,
                false
        );
        callback.onResult(new BeginCreateCredentialResponse(Collections.singletonList(entry), null));
    }

    @Override
    public void onClearCredentialStateRequest(
            ProviderClearCredentialStateRequest request,
            CancellationSignal cancellationSignal,
            OutcomeReceiver<Void, ClearCredentialException> callback) {
        // No provider-side selection cache is kept; encrypted Room/pending data
        // remains untouched by a clear-state request.
        callback.onResult(null);
    }

    private boolean hasPasswordOption(BeginGetCredentialRequest request) {
        for (androidx.credentials.provider.BeginGetCredentialOption option : request.getBeginGetCredentialOptions()) {
            if (option instanceof BeginGetPasswordOption) return true;
        }
        return false;
    }

    private PendingIntent pendingIntent(String mode, int requestCode) {
        Intent intent = new Intent(this, PasKeyCredentialActivity.class)
                .putExtra(PasKeyCredentialActivity.EXTRA_MODE, mode);
        return PendingIntent.getActivity(
                this,
                requestCode,
                intent,
                PendingIntent.FLAG_MUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
    }
}
