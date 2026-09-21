package com.paskey.vault.autofill;

import java.util.Locale;

public final class PasKeyAutofillMatcher {

    private PasKeyAutofillMatcher() {
    }

    public static String normalizeHost(String value) {
        if (value == null) {
            return "";
        }

        String host = value.trim().toLowerCase(Locale.ROOT);
        if (host.isEmpty()) {
            return "";
        }

        int scheme = host.indexOf("://");
        if (scheme >= 0) {
            host = host.substring(scheme + 3);
        }
        if (host.startsWith("//")) {
            host = host.substring(2);
        }

        int at = host.lastIndexOf('@');
        if (at >= 0) {
            host = host.substring(at + 1);
        }

        int end = host.length();
        for (char delimiter : new char[] {'/', '?', '#'}) {
            int index = host.indexOf(delimiter);
            if (index >= 0 && index < end) {
                end = index;
            }
        }
        host = host.substring(0, end);

        if (host.startsWith("www.")) {
            host = host.substring(4);
        }

        int colon = host.lastIndexOf(':');
        if (colon >= 0 && host.indexOf(']') < 0) {
            host = host.substring(0, colon);
        }

        return host.trim();
    }

    public static boolean matchesDomain(String savedWebsite, String targetWebDomain) {
        String target = normalizeHost(targetWebDomain);
        if (target.isEmpty() || savedWebsite == null) {
            return false;
        }

        for (String candidate : savedWebsite.split("[,;\\n]")) {
            String saved = normalizeHost(candidate);
            if (!saved.isEmpty() && target.equals(saved)) {
                return true;
            }
        }

        return false;
    }

    public static boolean matchesPackage(String savedPackage, String targetPackage) {
        if (savedPackage == null || targetPackage == null) {
            return false;
        }

        String target = targetPackage.trim();
        if (target.isEmpty()) {
            return false;
        }

        for (String candidate : savedPackage.split("[,;\\n]")) {
            String saved = candidate.trim();
            if (!saved.isEmpty() && saved.equals(target)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Web-domain evidence is stronger than the browser package. If Android
     * gives us a web domain, a saved Android package must never cause an
     * unrelated website login (for example localhost) to appear on Google.
     */
    public static int score(
            String savedWebsite,
            String savedPackage,
            String targetWebDomain,
            String targetPackage) {

        if (!normalizeHost(targetWebDomain).isEmpty()) {
            return matchesDomain(savedWebsite, targetWebDomain) ? 100 : 0;
        }

        return matchesPackage(savedPackage, targetPackage) ? 90 : 0;
    }
}
