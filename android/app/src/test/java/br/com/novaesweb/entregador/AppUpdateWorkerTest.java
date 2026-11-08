package br.com.novaesweb.entregador;

import org.junit.Test;
import java.lang.reflect.Field;
import static org.junit.Assert.*;

/** Production manifest value validation, with no Android services, credentials or network. */
public class AppUpdateWorkerTest {
    private static final String VERSION = "1.2.3";
    private static final String FILE = "NovaesWeb-Entregador-v1.2.3-code20.apk";
    private static final String URL = "https://painel-moto-three.vercel.app/downloads/" + FILE;
    private static final String HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final long SIZE = 14396661;

    private AppUpdateWorker.Release select(Object version, Object build, Object file, Object sha, Object size, long installed) {
        return AppUpdateWorker.selectHostedReleaseValues(version, build, file, sha, size, installed);
    }

    @Test public void acceptsOnlyExactHostedDownload() {
        assertTrue(AppUpdateWorker.validDownload(URL, VERSION, 20));
        String[] invalid = {
            URL + "?token=x", URL + "#fragment", " " + URL, URL + "\n", URL + " ",
            URL.replace("painel-moto-three.vercel.app", "painel-moto-three.vercel.app.evil.test"),
            URL.replace("https:", "http:"),
            URL.replace("painel-moto-three.vercel.app", "user@painel-moto-three.vercel.app"),
            URL.replace("painel-moto-three.vercel.app", "painel-moto-three.vercel.app:443"),
            URL.replace("/downloads/", "/Downloads/"),
            URL.replace("/downloads/", "/downloads/../downloads/"),
            URL.replace("/downloads/", "/%64ownloads/"),
            URL.replace("/downloads/", "/downloads/%2e%2e/downloads/"),
            URL.replace("code20.apk", "code21.apk"),
            URL.replace("code20.apk", "code20.apk.exe"),
            URL.replace("/downloads/", "//downloads/"),
            "https://github.com/Lkazin/painel-moto/releases/download/android-v1.2.3/" + FILE
        };
        for (String value : invalid) assertFalse(value, AppUpdateWorker.validDownload(value, VERSION, 20));
        assertFalse(AppUpdateWorker.validDownload(null, VERSION, 20));
        assertFalse(AppUpdateWorker.validDownload(URL, null, 20));
    }

    @Test public void rejectsInvalidVersionsAndBuilds() {
        for (String version : new String[]{"01.2.3", "1.02.3", "1.2.03", "1.2", "1.2.3-beta", "1.2.3\n", "1.2.3/../4", " 1.2.3"}) {
            assertFalse(version, AppUpdateWorker.validDownload(URL, version, 20));
            assertNull(select(version, 20, FILE, HASH, SIZE, 19));
        }
        for (long build : new long[]{-1, 0, 19, 21, 2147483648L, Long.MAX_VALUE}) assertFalse(AppUpdateWorker.validDownload(URL, VERSION, build));
        for (Object build : new Object[]{null, "20", true, -1, 0, 19, 20.5, Double.NaN, Double.POSITIVE_INFINITY, 2147483648L, Long.MAX_VALUE}) {
            assertNull(String.valueOf(build), select(VERSION, build, FILE, HASH, SIZE, 19));
        }
    }

    @Test public void selectsHostedManifestAndBindsIdentityToBuildAndChecksum() {
        AppUpdateWorker.Release release = select(VERSION, 20, FILE, HASH.toUpperCase(java.util.Locale.ROOT), SIZE, 19);
        assertNotNull(release);
        assertEquals(VERSION, release.version); assertEquals(20, release.build);
        assertEquals(URL, release.url); assertEquals(HASH, release.sha256); assertEquals(SIZE, release.size);
        assertEquals("hosted:20:" + HASH, release.id);
        assertTrue(AppUpdateWorker.validReleaseId(release.id, release.build));
        assertNull(select(VERSION, 20, FILE, HASH, SIZE, 20));
        assertNull(select(VERSION, 20, FILE, HASH, SIZE, 21));
        assertNull(select(VERSION, 20, FILE, HASH, SIZE, 0));
        assertNull(select(VERSION, 20, FILE, HASH, SIZE, -1));
        assertNull(AppUpdateWorker.selectHostedRelease(null, 19));
    }

    @Test public void rejectsUnsafeManifestFileAndMismatchedVersion() {
        for (Object file : new Object[]{null, 20, true, URL, "../" + FILE, "/downloads/" + FILE, "%2e%2e/" + FILE, FILE + "?download=1", FILE + "#x", FILE + "\n", FILE.replace("1.2.3", "1.2.4"), FILE.replace("code20", "code21")}) {
            assertNull(String.valueOf(file), select(VERSION, 20, file, HASH, SIZE, 19));
        }
        for (Object version : new Object[]{null, 123, true, "", "1.2.3 ", "1.2.4"}) assertNull(select(version, 20, FILE, HASH, SIZE, 19));
    }

    @Test public void rejectsMissingOrInvalidChecksumAndSize() {
        for (Object sha : new Object[]{null, 123, true, "", HASH.substring(1), HASH + "0", HASH + "\n", " " + HASH, HASH.replace('a', 'g')}) {
            assertNull(String.valueOf(sha), select(VERSION, 20, FILE, sha, SIZE, 19));
        }
        for (Object size : new Object[]{null, "14396661", true, -1, 0, 1.5, Double.NaN, Double.POSITIVE_INFINITY, AppUpdateWorker.MAX_APK_BYTES + 1, Long.MAX_VALUE}) {
            assertNull(String.valueOf(size), select(VERSION, 20, FILE, HASH, size, 19));
        }
        assertNotNull(select(VERSION, 20, FILE, HASH, 1, 19));
        assertNotNull(select(VERSION, 20, FILE, HASH, AppUpdateWorker.MAX_APK_BYTES, 19));
    }

    @Test public void releaseIdentityRejectsLegacyGithubIdsAndNonCanonicalHash() {
        assertTrue(AppUpdateWorker.validReleaseId("hosted:20:" + HASH, 20));
        for (String id : new String[]{"123:456:20", "hosted:21:" + HASH, "hosted:020:" + HASH, "hosted:20:" + HASH.toUpperCase(java.util.Locale.ROOT), "hosted:20:" + HASH + "\n", "hosted:20:" + HASH.substring(1), "hosted:20:" + HASH + ":other"}) {
            assertFalse(id, AppUpdateWorker.validReleaseId(id, 20));
        }
        assertFalse(AppUpdateWorker.validReleaseId(null, 20));
        assertFalse(AppUpdateWorker.validReleaseId("hosted:0:" + HASH, 0));
    }

    @Test public void manifestEndpointAndResponseLimitAreFixed() throws Exception {
        assertEquals("https://painel-moto-three.vercel.app/downloads/latest.json", AppUpdateWorker.MANIFEST);
        Field limit = AppUpdateWorker.class.getDeclaredField("MAX_BYTES"); limit.setAccessible(true);
        assertEquals(64 * 1024, limit.getInt(null));
        assertEquals(100L * 1024 * 1024, AppUpdateWorker.MAX_APK_BYTES);
    }
}
