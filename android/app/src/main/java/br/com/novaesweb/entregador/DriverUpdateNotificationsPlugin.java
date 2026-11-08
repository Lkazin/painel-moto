package br.com.novaesweb.entregador;

import androidx.core.app.NotificationManagerCompat;
import androidx.work.BackoffPolicy;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.concurrent.TimeUnit;

@CapacitorPlugin(name = "DriverUpdateNotifications")
public class DriverUpdateNotificationsPlugin extends Plugin {
    private JSObject currentStatus() {
        AppUpdateWorker.ensureChannel(getContext());
        AppUpdateWorker.clearInstalledNotice(getContext());
        JSObject result = new JSObject();
        result.put("enabled", AppUpdateWorker.enabled(getContext()));
        result.put("permissionGranted", AppUpdateWorker.permissionGranted(getContext()));
        result.put("channelEnabled", AppUpdateWorker.channelEnabled(getContext()));
        return result;
    }
    @PluginMethod public void status(PluginCall call) { call.resolve(currentStatus()); }

    @PluginMethod public void configure(PluginCall call) {
        Boolean requested = call.getBoolean("enabled");
        if (requested == null) { call.reject("Informe se os avisos estão ativados."); return; }
        try {
            AppUpdateWorker.ensureChannel(getContext());
            boolean enabled = requested && AppUpdateWorker.permissionGranted(getContext());
            synchronized (AppUpdateWorker.LOCK) {
                if (!AppUpdateWorker.prefs(getContext()).edit().putBoolean("enabled", enabled).commit()) throw new IllegalStateException("Preference unavailable");
                WorkManager manager = WorkManager.getInstance(getContext());
                if (enabled) {
                    PeriodicWorkRequest work = new PeriodicWorkRequest.Builder(AppUpdateWorker.class, 6, TimeUnit.HOURS)
                        .setConstraints(new Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 30, TimeUnit.MINUTES).build();
                    manager.enqueueUniquePeriodicWork(AppUpdateWorker.WORK, ExistingPeriodicWorkPolicy.KEEP, work);
                } else {
                    manager.cancelUniqueWork(AppUpdateWorker.WORK);
                    NotificationManagerCompat.from(getContext()).cancel(AppUpdateWorker.NOTIFICATION_ID);
                }
            }
            call.resolve(currentStatus());
        } catch (Exception ignored) { call.reject("Não foi possível configurar os avisos de atualização."); }
    }
    @PluginMethod public void notifyAvailable(PluginCall call) {
        String version = call.getString("version"), url = call.getString("url"), id = call.getString("releaseId");
        Object rawBuild = call.getData().opt("build");
        Integer build = rawBuild instanceof Number && ((Number) rawBuild).doubleValue() == Math.rint(((Number) rawBuild).doubleValue())
            && ((Number) rawBuild).doubleValue() > 0 && ((Number) rawBuild).doubleValue() <= Integer.MAX_VALUE ? ((Number) rawBuild).intValue() : null;
        if (build == null || !AppUpdateWorker.validDownload(url, version, build) || !AppUpdateWorker.validReleaseId(id, build)) {
            JSObject rejected = new JSObject(); rejected.put("delivered", false); rejected.put("reason", "invalid_release"); call.resolve(rejected); return;
        }
        String reason = AppUpdateWorker.notifyRelease(getContext(), new AppUpdateWorker.Release(version, build, url, id));
        JSObject result = new JSObject(); result.put("delivered", "delivered".equals(reason)); result.put("reason", reason); call.resolve(result);
    }
}
