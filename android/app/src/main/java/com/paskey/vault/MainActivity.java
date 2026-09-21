package com.paskey.vault;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;
import com.paskey.vault.plugin.PasKeySecurityPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PasKeySecurityPlugin.class);
        super.onCreate(savedInstanceState);

    }
}
