package br.com.novaesweb.entregador;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DriverSecureAccessPlugin.class);
        registerPlugin(DriverUpdateNotificationsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
