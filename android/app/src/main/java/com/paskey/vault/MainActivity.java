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
        ViewCompat.setOnApplyWindowInsetsListener(webView, (view, windowInsets) -> {
            Insets insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );

            String script =
                "document.documentElement.style.setProperty('--pk-safe-top','" + insets.top + "px');" +
                "document.documentElement.style.setProperty('--pk-safe-right','" + insets.right + "px');" +
                "document.documentElement.style.setProperty('--pk-safe-bottom','" + insets.bottom + "px');" +
                "document.documentElement.style.setProperty('--pk-safe-left','" + insets.left + "px');";

            webView.post(() -> webView.evaluateJavascript(script, null));
            return windowInsets;
        });
        ViewCompat.requestApplyInsets(webView);
    }
}
