package br.com.novaesweb.entregador;

import org.junit.Test;
import static org.junit.Assert.*;

public class DriverAppUpdaterPluginTest {
    private static final String URL = "https://painel-moto-three.vercel.app/downloads/NovaesWeb-Entregador-v1.2.3-code30.apk";
    private static final String SHA = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";
    @Test public void acceptsOnlyExactHostedApkAndNewerBuild() {
        assertTrue(DriverAppUpdaterPlugin.validMetadata("1.2.3", 30, URL, SHA, 1000, 29));
        assertTrue(DriverAppUpdaterPlugin.validMetadata("1.2.3", 30, URL, SHA.toUpperCase(), 1000, 29));
        for (String url : new String[]{URL+"?download=1",URL+"#fragment",URL.replace("https:","http:"),URL.replace("painel-moto-three.vercel.app","evil.test"),URL.replace("painel-moto-three.vercel.app","user@painel-moto-three.vercel.app"),URL.replace("painel-moto-three.vercel.app","painel-moto-three.vercel.app:443"),URL.replace("code30.apk","code31.apk")," "+URL}) {
            assertFalse(url, DriverAppUpdaterPlugin.validMetadata("1.2.3",30,url,SHA,1000,29));
        }
        assertFalse(DriverAppUpdaterPlugin.validMetadata("1.2.3",30,URL,SHA,1000,30));
        assertFalse(DriverAppUpdaterPlugin.validMetadata("1.2.3",30,URL,SHA,1000,31));
        assertFalse(DriverAppUpdaterPlugin.validMetadata("1.2.3",30,URL,SHA,1000,0));
    }
    @Test public void rejectsInvalidDigestSizeVersionAndBuild() {
        for (String sha : new String[]{"",SHA.substring(1),SHA+"0",SHA.replace('a','x'),SHA+"\n"}) assertFalse(DriverAppUpdaterPlugin.validMetadata("1.2.3",30,URL,sha,1000,29));
        for (long size : new long[]{0,-1,100L*1024*1024,Long.MAX_VALUE}) assertFalse(DriverAppUpdaterPlugin.validMetadata("1.2.3",30,URL,SHA,size,29));
        for (String version : new String[]{"01.2.3","1.2","1.2.3-beta","1.2.3\n"}) assertFalse(DriverAppUpdaterPlugin.validMetadata(version,30,URL,SHA,1000,29));
        assertFalse(DriverAppUpdaterPlugin.validMetadata("1.2.3",2147483648L,URL,SHA,1000,29));
        assertFalse(DriverAppUpdaterPlugin.validMetadata("1.2.3",30,URL,null,1000,29));
    }
}
