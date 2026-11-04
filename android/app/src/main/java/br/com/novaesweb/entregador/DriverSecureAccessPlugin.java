package br.com.novaesweb.entregador;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "DriverSecureAccess")
public class DriverSecureAccessPlugin extends Plugin {
    private static final String PREFS = "novaesweb_secure_driver_v1";
    private static final String KEY_ALIAS = "novaesweb_driver_aes_v1";
    private static final String ENABLED = "biometric_enabled";
    private boolean unlocked = false;

    private SharedPreferences prefs() { return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    private boolean enabled() { return prefs().getBoolean(ENABLED, false); }
    private boolean available() {
        return BiometricManager.from(getContext()).canAuthenticate(
            BiometricManager.Authenticators.BIOMETRIC_STRONG
        ) == BiometricManager.BIOMETRIC_SUCCESS;
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        SecretKey existing = (SecretKey) store.getKey(KEY_ALIAS, null);
        if (existing != null) return existing;
        KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
        generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS,
            KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(256).build());
        return generator.generateKey();
    }
    private void put(String name, String value) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, key());
        byte[] bytes = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        prefs().edit()
            .putString(name + "_iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .putString(name + "_blob", Base64.encodeToString(bytes, Base64.NO_WRAP)).apply();
    }
    private String get(String name) throws Exception {
        String blob = prefs().getString(name + "_blob", null);
        String iv = prefs().getString(name + "_iv", null);
        if (blob == null || iv == null) return null;
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, key(),
            new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(blob, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }
    private void erase(String name) {
        prefs().edit().remove(name + "_iv").remove(name + "_blob").apply();
    }
    private boolean validName(String name) { return "account".equals(name) || "offline".equals(name); }
    private void authenticate(String title, PluginCall call, Runnable onSuccess) {
        if (!available()) { call.reject("BIOMETRIC_UNAVAILABLE"); return; }
        getActivity().runOnUiThread(() -> {
            BiometricPrompt prompt = new BiometricPrompt((FragmentActivity) getActivity(),
                ContextCompat.getMainExecutor(getContext()),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        unlocked = true;
                        onSuccess.run();
                    }
                    @Override public void onAuthenticationError(int code, CharSequence message) {
                        super.onAuthenticationError(code, message);
                        call.reject("BIOMETRIC_CANCELLED_OR_FAILED");
                    }
                });
            prompt.authenticate(new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle("Confirme sua identidade no próprio aparelho")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .setNegativeButtonText("Cancelar")
                .build());
        });
    }

    @PluginMethod public void status(PluginCall call) {
        JSObject result = new JSObject();
        result.put("available", available());
        result.put("enabled", enabled());
        result.put("hasAccount", prefs().contains("account_blob"));
        call.resolve(result);
    }
    @PluginMethod public void save(PluginCall call) {
        String name = call.getString("name"), value = call.getString("value");
        if (!validName(name) || value == null) { call.reject("INVALID_DATA"); return; }
        try { put(name, value); call.resolve(); } catch (Exception e) { call.reject("SECURE_STORAGE_UNAVAILABLE"); }
    }
    @PluginMethod public void read(PluginCall call) {
        String name = call.getString("name");
        if (!validName(name)) { call.reject("INVALID_DATA"); return; }
        if (enabled() && !unlocked) { call.reject("BIOMETRIC_REQUIRED"); return; }
        try {
            JSObject result = new JSObject();
            result.put("value", get(name));
            call.resolve(result);
        } catch (Exception e) { call.reject("SECURE_STORAGE_UNAVAILABLE"); }
    }
    @PluginMethod public void unlock(PluginCall call) {
        if (!enabled()) { call.reject("BIOMETRIC_NOT_ENABLED"); return; }
        authenticate("Desbloquear NovaesWeb Entregador", call, () -> {
            try {
                JSObject result = new JSObject();
                result.put("value", get("account"));
                call.resolve(result);
            } catch (Exception e) { call.reject("SECURE_STORAGE_UNAVAILABLE"); }
        });
    }
    @PluginMethod public void configure(PluginCall call) {
        Boolean desired = call.getBoolean("enabled");
        if (desired == null) { call.reject("INVALID_DATA"); return; }
        if (desired == enabled()) { call.resolve(); return; }
        authenticate(desired ? "Ativar acesso por biometria" : "Desativar acesso por biometria",
            call, () -> { prefs().edit().putBoolean(ENABLED, desired).apply(); call.resolve(); });
    }
    @PluginMethod public void lock(PluginCall call) {
        unlocked = false; call.resolve();
    }
    @PluginMethod public void remove(PluginCall call) {
        String name = call.getString("name");
        if (!validName(name)) { call.reject("INVALID_DATA"); return; }
        erase(name);
        if ("account".equals(name)) { prefs().edit().putBoolean(ENABLED, false).apply(); unlocked = false; }
        call.resolve();
    }
}
