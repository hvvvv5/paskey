package com.paskey.vault.autofill;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class PasKeyAutofillMatcherTest {

    @Test
    public void googleWebsiteMatchesOnlyExactNormalizedHost() {
        assertEquals("accounts.google.com", PasKeyAutofillMatcher.normalizeHost("https://accounts.google.com/login"));
        assertTrue(PasKeyAutofillMatcher.matchesDomain("accounts.google.com", "accounts.google.com"));
        assertFalse(PasKeyAutofillMatcher.matchesDomain("google.com", "accounts.google.com"));
        assertFalse(PasKeyAutofillMatcher.matchesDomain("accounts.google.com", "localhost"));
    }

    @Test
    public void instagramPackageDoesNotMatchOtherApps() {
        assertTrue(PasKeyAutofillMatcher.matchesPackage("com.instagram.android", "com.instagram.android"));
        assertFalse(PasKeyAutofillMatcher.matchesPackage("com.instagram.android", "com.google.android.gms"));
        assertFalse(PasKeyAutofillMatcher.matchesPackage("com.instagram.android", "com.whatsapp"));
    }

    @Test
    public void localhostNeverSpillsIntoAnotherHost() {
        assertTrue(PasKeyAutofillMatcher.matchesDomain("localhost", "localhost"));
        assertFalse(PasKeyAutofillMatcher.matchesDomain("localhost", "accounts.google.com"));
        assertFalse(PasKeyAutofillMatcher.matchesDomain("accounts.google.com", "localhost"));
    }

    @Test
    public void webDomainEvidenceOverridesBrowserPackage() {
        assertEquals(0, PasKeyAutofillMatcher.score(
                "instagram.com",
                "com.android.chrome",
                "accounts.google.com",
                "com.android.chrome"
        ));
    }
}
