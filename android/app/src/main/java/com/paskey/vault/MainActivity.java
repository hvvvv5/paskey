package com.paskey.vault;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;
import com.paskey.vault.plugin.PasKeySecurityPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PasKeySecurityPlugin.class);
        super.onCreate(savedInstanceState);

        // PasKey: block screnshots, screen recording and recent-app previews
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
    }
}
