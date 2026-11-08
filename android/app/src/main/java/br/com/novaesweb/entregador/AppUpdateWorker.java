package br.com.novaesweb.entregador;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

/** Public release metadata only. Never shares account, store, GPS or installation credentials. */
public class AppUpdateWorker extends Worker {
    static final String CHANNEL = "atualizacoes_aplicativo";
    static final String WORK = "novaesweb-app-update-check-v1";
    static final int NOTIFICATION_ID = 71021;
    private static final String PACKAGE = "br.com.novaesweb.entregador";
    static final String UPDATE_ORIGIN = "https://painel-moto-three.vercel.app";
    static final String MANIFEST = UPDATE_ORIGIN + "/downloads/latest.json";
    private static final int MAX_BYTES = 64 * 1024;
    static final long MAX_APK_BYTES = 100L * 1024 * 1024;
    static final Object LOCK = new Object();

    public AppUpdateWorker(@NonNull Context context, @NonNull WorkerParameters params) { super(context, params); }
    static SharedPreferences prefs(Context context) { return context.getSharedPreferences("novaesweb_update_notifications_v1", Context.MODE_PRIVATE); }
    static boolean enabled(Context context) { return prefs(context).getBoolean("enabled", false); }
    static long currentBuild(Context context) throws PackageManager.NameNotFoundException {
        if (!PACKAGE.equals(context.getPackageName())) throw new SecurityException("Invalid application");
        android.content.pm.PackageInfo info = context.getPackageManager().getPackageInfo(PACKAGE, 0);
        return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
    }
    static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(CHANNEL, "Atualizações do aplicativo", NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("Avisos de novas versões do NovaesWeb Entregador");
            context.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }
    }
    static boolean permissionGranted(Context context) {
        return (Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED)
            && NotificationManagerCompat.from(context).areNotificationsEnabled();
    }
    static boolean channelEnabled(Context context) {
        if (Build.VERSION.SDK_INT < 26) return true;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = manager.getNotificationChannel(CHANNEL);
        if (channel == null || channel.getImportance() == NotificationManager.IMPORTANCE_NONE) return false;
        if (Build.VERSION.SDK_INT >= 28 && channel.getGroup() != null) {
            android.app.NotificationChannelGroup group = manager.getNotificationChannelGroup(channel.getGroup());
            if (group != null && group.isBlocked()) return false;
        }
        return true;
    }
    static void clearInstalledNotice(Context context) {
        try { if (prefs(context).getLong("notified_build", 0) <= currentBuild(context)) NotificationManagerCompat.from(context).cancel(NOTIFICATION_ID); }
        catch (Exception ignored) { }
    }
    static boolean validDownload(String value, String version, long build) {
        if (value == null || version == null || version.length() > 64 || !version.matches("(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)") || build <= 0 || build > Integer.MAX_VALUE || !value.equals(value.trim()) || value.matches("(?s).*[\\x00-\\x20\\x7f].*")) return false;
        try {
            URI uri = new URI(value);
            String expected = "/downloads/NovaesWeb-Entregador-v" + version + "-code" + build + ".apk";
            return "https".equals(uri.getScheme()) && "painel-moto-three.vercel.app".equals(uri.getRawAuthority()) && uri.getRawUserInfo() == null
                && uri.getRawQuery() == null && uri.getRawFragment() == null && expected.equals(uri.getRawPath());
        } catch (Exception ignored) { return false; }
    }
    static final class Release {
        final String version, url, id, sha256;
        final long build, size;
        Release(String version, long build, String url, String id) { this(version, build, url, id, null, 0); }
        Release(String version, long build, String url, String id, String sha256, long size) {
            this.version = version; this.build = build; this.url = url; this.id = id; this.sha256 = sha256; this.size = size;
        }
    }
    static boolean validReleaseId(String id, long build) {
        return id != null && build > 0 && build <= Integer.MAX_VALUE && id.matches("hosted:" + build + ":[a-f0-9]{64}");
    }
    private static long positiveInteger(Object value) {
        if (!(value instanceof Number)) return -1;
        double number = ((Number) value).doubleValue();
        if (Double.isNaN(number) || Double.isInfinite(number) || number <= 0 || number > 9007199254740991L || number != Math.rint(number)) return -1;
        return ((Number) value).longValue();
    }
    static Release selectHostedRelease(JSONObject manifest, long installed) {
        if (manifest == null) return null;
        return selectHostedReleaseValues(manifest.opt("version"), manifest.opt("build"), manifest.opt("file"), manifest.opt("sha256"), manifest.opt("size"), installed);
    }
    /** Pure validator shared with the JSON selector, including untrusted value types. */
    static Release selectHostedReleaseValues(Object rawVersion, Object rawBuild, Object rawFile, Object rawSha, Object rawSize, long installed) {
        if (installed <= 0 || installed > Integer.MAX_VALUE) return null;
        if (!(rawVersion instanceof String) || !(rawFile instanceof String) || !(rawSha instanceof String)) return null;
        long build = positiveInteger(rawBuild);
        long size = positiveInteger(rawSize);
        String version = (String) rawVersion, file = (String) rawFile, sha256 = (String) rawSha;
        if (build <= installed || build > Integer.MAX_VALUE || size <= 0 || size > MAX_APK_BYTES || !sha256.matches("[a-fA-F0-9]{64}")) return null;
        String expected = "NovaesWeb-Entregador-v" + version + "-code" + build + ".apk";
        if (!expected.equals(file)) return null;
        String url = UPDATE_ORIGIN + "/downloads/" + file;
        if (!validDownload(url, version, build)) return null;
        sha256 = sha256.toLowerCase(Locale.ROOT);
        return new Release(version, build, url, "hosted:" + build + ":" + sha256, sha256, size);
    }
    /** Shared by the foreground bridge and worker; mark dedup only after notify succeeds. */
    static String notifyRelease(Context context, Release release) {
        synchronized (LOCK) {
            try {
                if (!enabled(context)) return "disabled";
                if (!validDownload(release.url, release.version, release.build) || !validReleaseId(release.id, release.build)) return "invalid_release";
                if (release.build <= currentBuild(context)) { clearInstalledNotice(context); return "already_installed"; }
                ensureChannel(context);
                if (!permissionGranted(context)) return "permission_denied";
                if (!channelEnabled(context)) return "channel_disabled";
                if (release.build <= prefs(context).getLong("notified_build", 0)) return "already_notified";
                // Revalidate immediately before creating the immutable download intent.
                if (!validDownload(release.url, release.version, release.build)) return "invalid_release";
                Intent intent = new Intent(context, AppUpdateDownloadActivity.class);
                intent.putExtra("canonicalUrl", release.url);
                intent.putExtra("version", release.version);
                intent.putExtra("build", release.build);
                PendingIntent download = PendingIntent.getActivity(context, NOTIFICATION_ID, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                android.app.Notification notification = new NotificationCompat.Builder(context, CHANNEL)
                    .setSmallIcon(android.R.drawable.stat_sys_download_done)
                    .setContentTitle("Nova versão disponível")
                    .setContentText("NovaesWeb Entregador " + release.version + ". Toque para baixar a atualização.")
                    .setStyle(new NotificationCompat.BigTextStyle().bigText("NovaesWeb Entregador " + release.version + ". Toque para baixar. Conclua suas entregas antes de instalar. A instalação será confirmada por você no Android."))
                    .setContentIntent(download).setAutoCancel(true).setOnlyAlertOnce(true)
                    .setPriority(NotificationCompat.PRIORITY_DEFAULT).build();
                NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification);
                prefs(context).edit().putLong("notified_build", release.build).putString("notified_release", release.id).commit();
                return "delivered";
            } catch (SecurityException ignored) { return "permission_denied"; }
            catch (Exception ignored) { return "unavailable"; }
        }
    }
    private JSONObject fetchManifest() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(MANIFEST).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000); connection.setReadTimeout(10000);
        connection.setRequestMethod("GET"); connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/json");
        connection.setRequestProperty("User-Agent", "NovaesWeb-Entregador-UpdateChecker");
        connection.setRequestProperty("Cookie", "");
        connection.setRequestProperty("Authorization", "");
        try {
            if (connection.getResponseCode() != 200) throw new java.io.IOException("Release check unavailable");
            if (connection.getContentLengthLong() > MAX_BYTES) throw new java.io.IOException("Response too large");
            long deadline = android.os.SystemClock.elapsedRealtime() + 20000;
            try (InputStream input = connection.getInputStream(); ByteArrayOutputStream bytes = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[8192]; int read;
                while ((read = input.read(buffer)) != -1) {
                    if (isStopped() || bytes.size() + read > MAX_BYTES || android.os.SystemClock.elapsedRealtime() > deadline) throw new java.io.IOException("Release check interrupted");
                    bytes.write(buffer, 0, read);
                }
                return new JSONObject(bytes.toString(StandardCharsets.UTF_8.name()));
            }
        } finally { connection.disconnect(); }
    }
    @NonNull @Override public Result doWork() {
        Context context = getApplicationContext();
        clearInstalledNotice(context);
        if (!enabled(context) || !permissionGranted(context)) return Result.success();
        ensureChannel(context);
        if (!channelEnabled(context)) return Result.success();
        try {
            Release release = selectHostedRelease(fetchManifest(), currentBuild(context));
            if (!isStopped() && release != null) notifyRelease(context, release);
            return Result.success();
        } catch (Exception ignored) {
            // Bounded retries for one periodic occurrence; normal 6-hour checks remain scheduled.
            return !isStopped() && getRunAttemptCount() < 2 ? Result.retry() : Result.success();
        }
    }
}
