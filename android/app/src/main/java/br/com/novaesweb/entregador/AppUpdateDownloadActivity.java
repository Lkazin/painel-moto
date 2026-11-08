package br.com.novaesweb.entregador;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

/** Private notification target: return to the in-app updater, never to a browser. */
public class AppUpdateDownloadActivity extends Activity {
    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            Intent updater = new Intent(this, MainActivity.class);
            updater.setAction(Intent.ACTION_VIEW);
            updater.setData(Uri.parse("novaesweb-entregador://updates"));
            updater.putExtra("novaeswebUpdate", true);
            updater.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            startActivity(updater);
        } catch (Exception ignored) {
            // An invalid/stale intent or missing browser never interrupts an active delivery.
        } finally {
            finish();
        }
    }
}
