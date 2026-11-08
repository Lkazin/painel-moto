package br.com.novaesweb.entregador;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.net.URI;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "DriverAppUpdater")
public class DriverAppUpdaterPlugin extends Plugin {
    private static final String PACKAGE = "br.com.novaesweb.entregador";
    private static final long MAX_SIZE = 100L * 1024 * 1024;
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();
    private static final Object LOCK = new Object();
    private SharedPreferences prefs() { return getContext().getSharedPreferences("novaesweb_native_updater_v1", Context.MODE_PRIVATE); }
    private DownloadManager manager() { return (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE); }
    static boolean validMetadata(String version, long build, String url, String sha, long size, long installed) {
        if (version == null || !version.matches("(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)\\.(?:0|[1-9]\\d*)") || build <= installed || installed <= 0 || build > Integer.MAX_VALUE || size <= 0 || size >= MAX_SIZE || sha == null || !sha.matches("[a-fA-F0-9]{64}")) return false;
        String expected = "https://painel-moto-three.vercel.app/downloads/NovaesWeb-Entregador-v" + version + "-code" + build + ".apk";
        try { return expected.equals(url) && new URI(url).getRawQuery() == null; }
        catch (Exception ignored) { return false; }
    }
    private static long strictLong(Object value) {
        if (!(value instanceof Number)) return -1;
        double number = ((Number) value).doubleValue();
        return Double.isFinite(number) && number == Math.rint(number) && number > 0 && number <= 9007199254740991L ? ((Number) value).longValue() : -1;
    }
    private long installedBuild() throws Exception { return AppUpdateWorker.currentBuild(getContext()); }
    private File downloadFile(long build) throws Exception {
        File directory = getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (directory == null || build <= 0 || build > Integer.MAX_VALUE) throw new Exception();
        File file = new File(directory, "NovaesWeb-update-code" + build + ".apk");
        if (!file.getCanonicalFile().getParentFile().equals(directory.getCanonicalFile())) throw new Exception();
        return file;
    }
    private JSObject result(String state, Integer progress, String message) {
        JSObject value = new JSObject(); value.put("state", state); value.put("progress", progress == null ? org.json.JSONObject.NULL : progress);
        value.put("message", message == null ? org.json.JSONObject.NULL : message);
        String version = prefs().getString("version", null);
        if (version != null) { value.put("version", version); value.put("build", prefs().getLong("build", 0)); }
        return value;
    }
    private static long versionCode(PackageInfo info) { return Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode; }
    private static Set<String> certificates(PackageInfo info) throws Exception {
        Signature[] signatures = Build.VERSION.SDK_INT >= 28
            ? (info.signingInfo == null ? null : info.signingInfo.getApkContentsSigners()) : info.signatures;
        if (signatures == null || signatures.length == 0) throw new Exception();
        Set<String> result = new HashSet<>();
        for (Signature signature : signatures) result.add(hex(MessageDigest.getInstance("SHA-256").digest(signature.toByteArray())));
        return result;
    }
    private static String hex(byte[] bytes) {
        StringBuilder text = new StringBuilder(bytes.length * 2);
        for (byte item : bytes) text.append(String.format(java.util.Locale.US, "%02x", item & 255));
        return text.toString();
    }
    private void verify(File file) throws Exception {
        SharedPreferences data = prefs();
        String version = data.getString("version", ""), sha = data.getString("sha256", "");
        long build = data.getLong("build", 0), size = data.getLong("size", 0);
        if (!validMetadata(version, build, data.getString("url", ""), sha, size, installedBuild()) || !file.isFile() || file.length() != size) throw new Exception();
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        long count = 0;
        try (FileInputStream input = new FileInputStream(file)) {
            byte[] buffer = new byte[32768]; int read;
            while ((read = input.read(buffer)) != -1) { count += read; if (count > size) throw new Exception(); digest.update(buffer, 0, read); }
        }
        if (count != size || !hex(digest.digest()).equalsIgnoreCase(sha)) throw new Exception();
        int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
        PackageManager pm = getContext().getPackageManager();
        PackageInfo archive = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
        PackageInfo installed = pm.getPackageInfo(PACKAGE, flags);
        if (archive == null || !PACKAGE.equals(archive.packageName) || !PACKAGE.equals(getContext().getPackageName()) || versionCode(archive) != build || !version.equals(archive.versionName) || !certificates(installed).equals(certificates(archive))) throw new Exception();
    }
    private JSObject currentStatus() {
        long id = prefs().getLong("downloadId", -1), build = prefs().getLong("build", 0);
        if (id <= 0) return result("idle", null, null);
        try {
            if (build <= installedBuild()) return result("idle", null, "O aplicativo já está atualizado.");
            try (Cursor cursor = manager().query(new DownloadManager.Query().setFilterById(id))) {
                if (cursor == null || !cursor.moveToFirst()) return result("failed", null, "O download não está mais disponível. Baixe novamente.");
                int state = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long bytes = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long expected = prefs().getLong("size", 0);
                if (bytes > expected || expected <= 0) { manager().remove(id); return result("failed", null, "O arquivo recebido tem tamanho inválido. Baixe novamente."); }
                int progress = (int) Math.min(99, Math.max(0, bytes) * 100 / expected);
                if (state == DownloadManager.STATUS_PENDING || state == DownloadManager.STATUS_RUNNING) return result("downloading", progress, "Baixando atualização no aplicativo...");
                if (state == DownloadManager.STATUS_PAUSED) return result("paused", progress, "Download pausado. O Android retomará quando houver conexão disponível.");
                if (state == DownloadManager.STATUS_FAILED) return result("failed", null, "Não foi possível baixar. Confira a conexão e o espaço disponível e tente novamente.");
                if (state != DownloadManager.STATUS_SUCCESSFUL) return result("failed", null, "Download indisponível. Tente novamente.");
            }
            verify(downloadFile(build));
            if (prefs().getBoolean("permissionRequested", false) && Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) return result("permission", 100, "Autorize o NovaesWeb Entregador a instalar esta atualização e depois toque em Instalar novamente.");
            return result("ready", 100, "Atualização conferida. Conclua suas entregas e toque em Instalar.");
        } catch (Exception ignored) { return result("failed", null, "Não foi possível validar o arquivo com segurança. Baixe novamente."); }
    }
    @PluginMethod public void status(PluginCall call) { IO.execute(() -> { synchronized (LOCK) { call.resolve(currentStatus()); } }); }
    @PluginMethod public void start(PluginCall call) {
        IO.execute(() -> { synchronized (LOCK) {
            try {
                String version = call.getString("version"), url = call.getString("url"), sha = call.getString("sha256");
                long build = strictLong(call.getData().opt("build")), size = strictLong(call.getData().opt("size"));
                if (!validMetadata(version, build, url, sha, size, installedBuild())) { call.resolve(result("failed", null, "Os dados da atualização não são válidos. Verifique novamente.")); return; }
                JSObject previous = currentStatus();
                String state = previous.getString("state");
                if ("downloading".equals(state) || "paused".equals(state) || (("ready".equals(state) || "permission".equals(state)) && build == prefs().getLong("build", 0) && sha.equalsIgnoreCase(prefs().getString("sha256", "")))) { call.resolve(previous); return; }
                long oldId = prefs().getLong("downloadId", -1);
                if (oldId > 0) manager().remove(oldId);
                File destination = downloadFile(build);
                if (destination.exists() && !destination.delete()) throw new Exception();
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url))
                    .setTitle("Atualização do NovaesWeb Entregador")
                    .setDescription("Baixando versão " + version + " no aplicativo")
                    .setMimeType("application/vnd.android.package-archive")
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
                    .setDestinationInExternalFilesDir(getContext(), Environment.DIRECTORY_DOWNLOADS, destination.getName())
                    .setAllowedOverMetered(true).setAllowedOverRoaming(false);
                long id = manager().enqueue(request);
                if (id <= 0) throw new Exception();
                if (!prefs().edit().putString("version", version).putLong("build", build).putString("url", url).putString("sha256", sha.toLowerCase(java.util.Locale.US)).putLong("size", size).putLong("downloadId", id).putBoolean("permissionRequested", false).commit()) { manager().remove(id); throw new Exception(); }
                call.resolve(currentStatus());
            } catch (Exception ignored) { call.resolve(result("failed", null, "Não foi possível iniciar o download. Confira a conexão e tente novamente.")); }
        } });
    }
    @PluginMethod public void install(PluginCall call) {
        IO.execute(() -> { synchronized (LOCK) {
            try {
                JSObject status = currentStatus();
                String state = status.getString("state");
                if (!"ready".equals(state) && !"permission".equals(state)) { call.resolve(status); return; }
                // Never open an installer or permission screen from download completion or status polling.
                if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                    prefs().edit().putBoolean("permissionRequested", true).commit();
                    Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + PACKAGE));
                    settings.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK); getContext().startActivity(settings);
                    call.resolve(result("permission", 100, "Autorize a instalação pelo NovaesWeb Entregador e volte para tocar em Instalar novamente.")); return;
                }
                // Copy into private cache, then recheck that exact copy before granting installer read access.
                File directory = new File(getContext().getCacheDir(), "app-updates");
                if (!directory.isDirectory() && !directory.mkdirs()) throw new Exception();
                File target = new File(directory, "verified-update-code" + prefs().getLong("build", 0) + ".apk");
                try (FileInputStream input = new FileInputStream(downloadFile(prefs().getLong("build", 0)));
                     FileOutputStream output = new FileOutputStream(target, false)) {
                    byte[] buffer = new byte[32768]; int read; long count = 0;
                    while ((read = input.read(buffer)) != -1) { count += read; if (count > prefs().getLong("size", 0)) throw new Exception(); output.write(buffer, 0, read); }
                    output.getFD().sync();
                }
                verify(target);
                Uri uri = FileProvider.getUriForFile(getContext(), PACKAGE + ".fileprovider", target);
                Intent installer = new Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive");
                installer.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installer.setClipData(android.content.ClipData.newRawUri("Atualização verificada", uri));
                getContext().startActivity(installer);
                call.resolve(result("ready", 100, "Confirme a instalação na tela do Android. Seus dados serão preservados."));
            } catch (Exception ignored) { call.resolve(result("failed", null, "Não foi possível abrir a instalação com segurança. Verifique o arquivo e tente novamente.")); }
        } });
    }
}
