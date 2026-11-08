package br.com.novaesweb.entregador;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** Private notification target: build a fresh public download link only when tapped. */
public class AppUpdateDownloadActivity extends Activity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            Intent source = getIntent();
            String url = AppUpdateWorker.freshDownloadUrl(
                source.getStringExtra("canonicalUrl"), source.getStringExtra("version"),
                source.getLongExtra("build", 0), AppUpdateWorker.currentBuild(this), System.currentTimeMillis());
            if (url == null) {
                AppUpdateWorker.clearInstalledNotice(this);
                return;
            }
            Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            browser.addCategory(Intent.CATEGORY_BROWSABLE);
            browser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(browser);
        } catch (Exception ignored) {
            // An invalid/stale intent or missing browser never interrupts an active delivery.
        } finally {
            finish();
        }
    }
}
