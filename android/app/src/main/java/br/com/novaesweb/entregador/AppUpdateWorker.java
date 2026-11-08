package br.com.novaesweb.entregador;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.ParsePosition;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** Public release metadata only. Never shares account, store, GPS or installation credentials. */
public class AppUpdateWorker extends Worker {
    static final String CHANNEL = "atualizacoes_aplicativo";
    static final String WORK = "novaesweb-app-update-check-v1";
    static final int NOTIFICATION_ID = 71021;
    private static final String PACKAGE = "br.com.novaesweb.entregador";
    private static final String API = "https://api.github.com/repos/Lkazin/painel-moto/releases?per_page=10";
    private static final int MAX_BYTES = 1024 * 1024;
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
        if (value == null || version == null || !version.matches("(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)") || build <= 0 || build > Integer.MAX_VALUE || !value.equals(value.trim()) || value.matches("(?s).*[\\x00-\\x20\\x7f].*")) return false;
        try {
            URI uri = new URI(value);
            String expected = "/Lkazin/painel-moto/releases/download/android-v" + version + "/NovaesWeb-Entregador-v" + version + "-code" + build + ".apk";
            return "https".equals(uri.getScheme()) && "github.com".equals(uri.getRawAuthority()) && uri.getRawUserInfo() == null
                && uri.getRawQuery() == null && uri.getRawFragment() == null && expected.equals(uri.getRawPath());
        } catch (Exception ignored) { return false; }
    }
    static final class Release {
        final String version, url, id;
        final long build;
        Release(String version, long build, String url, String id) { this.version = version; this.build = build; this.url = url; this.id = id; }
    }
    static boolean validReleaseId(String id, long build) {
        return id != null && id.length() < 100 && id.matches("[1-9]\\d*:[1-9]\\d*:" + build);
    }
    private static long positiveInteger(Object value) {
        String text = String.valueOf(value);
        if (!text.matches("[1-9]\\d*")) return -1;
        try { long result = Long.parseLong(text); return result <= 9007199254740991L ? result : -1; }
        catch (NumberFormatException ignored) { return -1; }
    }
    private static boolean validPublishedAt(String value, long now) {
        if (!value.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d{3})?Z")) return false;
        SimpleDateFormat format = new SimpleDateFormat(value.contains(".") ? "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'" : "yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC")); format.setLenient(false);
        ParsePosition position = new ParsePosition(0);
        Date parsed = format.parse(value, position);
        return parsed != null && position.getIndex() == value.length() && parsed.getTime() <= now + 300000;
    }
    static Release selectRelease(JSONArray releases, long installed, long now) {
        Release best = null;
        for (int i = 0; i < Math.min(10, releases.length()); i++) {
            JSONObject release = releases.optJSONObject(i);
            if (release == null || !Boolean.FALSE.equals(release.opt("draft")) || !Boolean.FALSE.equals(release.opt("prerelease"))) continue;
            String tag = release.optString("tag_name", "");
            if (!tag.matches("android-v(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)")) continue;
            long releaseId = positiveInteger(release.opt("id"));
            if (releaseId <= 0) continue;
            if (!validPublishedAt(release.optString("published_at", ""), now)) continue;
            String version = tag.substring(9);
            JSONArray assets = release.optJSONArray("assets");
            if (assets == null) continue;
            for (int j = 0; j < Math.min(30, assets.length()); j++) {
                JSONObject asset = assets.optJSONObject(j);
                if (asset == null || !"uploaded".equals(asset.optString("state"))) continue;
                long assetId = positiveInteger(asset.opt("id"));
                if (assetId <= 0 || positiveInteger(asset.opt("size")) <= 0) continue;
                String name = asset.optString("name", "");
                String prefix = "NovaesWeb-Entregador-v" + version + "-code";
                if (!name.startsWith(prefix) || !name.endsWith(".apk")) continue;
                long build = positiveInteger(name.substring(prefix.length(), name.length() - 4));
                String url = asset.optString("browser_download_url", "");
                if (build <= installed || (best != null && build <= best.build) || !validDownload(url, version, build)) continue;
                best = new Release(version, build, url, releaseId + ":" + assetId + ":" + build);
            }
        }
        return best;
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
                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(release.url)).addCategory(Intent.CATEGORY_BROWSABLE);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
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
    private JSONArray fetchReleases() throws Exception {
        HttpURLConnection connection = (HttpURLConnection) new URL(API).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000); connection.setReadTimeout(10000);
        connection.setRequestMethod("GET"); connection.setUseCaches(false);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        connection.setRequestProperty("User-Agent", "NovaesWeb-Entregador-UpdateChecker");
        connection.setRequestProperty("Cookie", "");
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
                return new JSONArray(bytes.toString(StandardCharsets.UTF_8.name()));
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
            Release release = selectRelease(fetchReleases(), currentBuild(context), System.currentTimeMillis());
            if (!isStopped() && release != null) notifyRelease(context, release);
            return Result.success();
        } catch (Exception ignored) {
            // Bounded retries for one periodic occurrence; normal 6-hour checks remain scheduled.
            return !isStopped() && getRunAttemptCount() < 2 ? Result.retry() : Result.success();
        }
    }
}
