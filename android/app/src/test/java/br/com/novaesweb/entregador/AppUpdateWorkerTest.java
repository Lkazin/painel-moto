package br.com.novaesweb.entregador;

import org.junit.Test;
import java.lang.reflect.Method;
import static org.junit.Assert.*;

/** Exercises the production validators directly; no Android services or network required. */
public class AppUpdateWorkerTest {
    private static final String URL = "https://github.com/Lkazin/painel-moto/releases/download/android-v1.2.3/NovaesWeb-Entregador-v1.2.3-code20.apk";

    @Test public void acceptsOnlyExactOfficialDownload() {
        assertTrue(AppUpdateWorker.validDownload(URL, "1.2.3", 20));
        String[] invalid = {
            URL + "?token=x", URL + "#fragment", " " + URL, URL + "\n",
            URL.replace("github.com", "github.com.evil.test"),
            URL.replace("https:", "http:"),
            URL.replace("github.com", "user@github.com"),
            URL.replace("github.com", "github.com:443"),
            URL.replace("Lkazin", "OtherOwner"),
            URL.replace("painel-moto", "other-repo"),
            URL.replace("android-v1.2.3", "android-v1.2.4"),
            URL.replace("code20.apk", "code21.apk"),
            URL.replace("/Lkazin/", "/%4ckazin/"),
            URL.replace("/releases/", "/other/../releases/"),
            URL.replace("code20.apk", "code20.apk.exe")
        };
        for (String value : invalid) assertFalse(value, AppUpdateWorker.validDownload(value, "1.2.3", 20));
        assertFalse(AppUpdateWorker.validDownload(null, "1.2.3", 20));
        assertFalse(AppUpdateWorker.validDownload(URL, null, 20));
    }

    @Test public void rejectsInvalidVersionsAndBuilds() {
        for (String version : new String[]{"01.2.3", "1.02.3", "1.2.03", "1.2", "1.2.3-beta", "1.2.3\n"}) {
            assertFalse(version, AppUpdateWorker.validDownload(URL, version, 20));
        }
        for (long build : new long[]{-1, 0, 19, 21, 2147483648L, Long.MAX_VALUE}) {
            assertFalse(AppUpdateWorker.validDownload(URL, "1.2.3", build));
        }
    }

    @Test public void releaseIdentityMustMatchBuildAndPositiveIds() {
        assertTrue(AppUpdateWorker.validReleaseId("123:456:20", 20));
        for (String id : new String[]{"123:456:21", "0:456:20", "123:0:20", "01:456:20", "123:456:020", "123:456:20\n", "123:456:20:other", "123:456"}) {
            assertFalse(id, AppUpdateWorker.validReleaseId(id, 20));
        }
        assertFalse(AppUpdateWorker.validReleaseId(null, 20));
    }

    @Test public void freshDownloadIsGeneratedFromCanonicalAtTapAndRejectsInstalledBuild() {
        String first = AppUpdateWorker.freshDownloadUrl(URL, "1.2.3", 20, 19, 1000);
        String later = AppUpdateWorker.freshDownloadUrl(URL, "1.2.3", 20, 19, 2000);
        assertEquals(URL + "?download=1&nw_update=1000", first);
        assertEquals(URL + "?download=1&nw_update=2000", later);
        assertNotEquals(first, later);
        // Generated queries are never accepted as canonical input on another tap.
        assertNull(AppUpdateWorker.freshDownloadUrl(first, "1.2.3", 20, 19, 3000));
        assertNull(AppUpdateWorker.freshDownloadUrl(URL, "1.2.3", 20, 20, 3000));
        assertNull(AppUpdateWorker.freshDownloadUrl(URL, "1.2.3", 20, 21, 3000));
        assertNull(AppUpdateWorker.freshDownloadUrl(URL, "1.2.3", 20, 0, 3000));
        assertNull(AppUpdateWorker.freshDownloadUrl(URL, "1.2.3", 20, 19, 0));
        assertNull(AppUpdateWorker.freshDownloadUrl(URL.replace("github.com", "evil.test"), "1.2.3", 20, 19, 3000));
        assertFalse(AppUpdateWorker.validDownload(first, "1.2.3", 20));
    }

    private boolean published(String value, long now) throws Exception {
        Method validator = AppUpdateWorker.class.getDeclaredMethod("validPublishedAt", String.class, long.class);
        validator.setAccessible(true);
        return (boolean) validator.invoke(null, value, now);
    }

    @Test public void publicationDateIsStrictUtcAndNotFuture() throws Exception {
        long now = 1794009600000L; // 2026-11-07T00:00:00Z
        assertTrue(published("2026-11-07T00:00:00Z", now));
        assertTrue(published("2026-11-07T00:00:00.123Z", now));
        assertTrue(published("2024-02-29T12:00:00Z", now));
        assertTrue(published("2026-11-07T00:05:00Z", now));
        for (String date : new String[]{"2026-11-07T00:05:01Z", "2099-01-01T00:00:00Z", "2026-02-29T12:00:00Z", "2026-13-01T00:00:00Z", "2026-11-07T24:00:00Z", "2026-11-07T00:00:00Zjunk", "2026-11-07T00:00:00+00:00", "", "not-a-date"}) {
            assertFalse(date, published(date, now));
        }
    }
}
