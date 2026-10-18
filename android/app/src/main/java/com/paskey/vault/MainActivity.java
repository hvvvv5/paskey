package com.paskey.vault;

import android.os.Bundle;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;
import com.paskey.vault.plugin.PasKeySecurityPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PasKeySecurityPlugin.class);
        super.onCreate(savedInstanceState);
        installSystemBarInsets();
    }

    private void installSystemBarInsets() {
        final WebView webView = getBridge().getWebView();
        final float density = getResources().getDisplayMetrics().density;

        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );

            int topDp = Math.round(insets.top / density);
            int rightDp = Math.round(insets.right / density);
            int bottomDp = Math.round(insets.bottom / density);
            int leftDp = Math.round(insets.left / density);

            String script =
                "document.documentElement.style.setProperty('--pk-safe-top','" + topDp + "px');" +
                "document.documentElement.style.setProperty('--pk-safe-right','" + rightDp + "px');" +
                "document.documentElement.style.setProperty('--pk-safe-bottom','" + bottomDp + "px');" +
                "document.documentElement.style.setProperty('--pk-safe-left','" + leftDp + "px');";

            webView.post(() -> webView.evaluateJavascript(script, null));
            return windowInsets;
        });

        ViewCompat.requestApplyInsets(webView);
    }
}
