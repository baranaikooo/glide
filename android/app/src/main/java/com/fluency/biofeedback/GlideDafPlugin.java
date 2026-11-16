package com.fluency.biofeedback;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(name="GlideDaf", permissions={@Permission(alias="notifications", strings={Manifest.permission.POST_NOTIFICATIONS})})
public class GlideDafPlugin extends Plugin {
    private final Handler main=new Handler(Looper.getMainLooper());
    @PluginMethod public void start(PluginCall call) {
        if(Build.VERSION.SDK_INT>=33 && ContextCompat.checkSelfPermission(getContext(),Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED){ requestPermissionForAlias("notifications",call,"notificationResult"); return; }
        if (DafForegroundService.running) { call.resolve(new JSObject().put("active",true)); return; }
        if(ContextCompat.checkSelfPermission(getContext(),Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){call.reject("Povoľ prístup k mikrofónu v nastaveniach telefónu.");return;}
        AudioManager manager=(AudioManager)getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        if(DafForegroundService.headphones(manager)==null){call.reject("Pripoj slúchadlá a skús to znova.");return;}
        try {
            DafForegroundService.error="";
            Intent intent=new Intent(getContext(),DafForegroundService.class).putExtra("delay",call.getInt("delay",70)).putExtra("volume",call.getInt("volume",70));
            ContextCompat.startForegroundService(getContext(),intent);
            pollStart(call,0);
        } catch(Exception ex) { call.reject("Asistenta sa nepodarilo spustiť. Skontroluj povolenie mikrofónu.",ex); }
    }
    @PermissionCallback private void notificationResult(PluginCall call) {
        if(ContextCompat.checkSelfPermission(getContext(),Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED) { call.reject("Povoľ oznámenia pre Glide, aby si mohol asistenta vypnúť aj na pozadí."); return; }
        start(call);
    }
    private void pollStart(PluginCall call,int tries) {
        if(DafForegroundService.running){call.resolve(new JSObject().put("active",true));return;}
        if(!DafForegroundService.error.isEmpty()){call.reject(DafForegroundService.error);return;}
        if(tries>=40){getContext().stopService(new Intent(getContext(),DafForegroundService.class));call.reject("Asistent sa nespustil včas.");return;}
        main.postDelayed(() -> pollStart(call,tries+1),100);
    }
    @PluginMethod public void stop(PluginCall call){ getContext().stopService(new Intent(getContext(),DafForegroundService.class)); call.resolve(); }
    @PluginMethod public void setOptions(PluginCall call){ FeedbackProcessor p=DafForegroundService.processor; if(p!=null){Integer d=call.getInt("delay");Integer v=call.getInt("volume");if(d!=null)p.setDelay(d);if(v!=null)p.setVolume(v);}call.resolve(); }
    @PluginMethod public void status(PluginCall call){call.resolve(new JSObject().put("active",DafForegroundService.running).put("error",DafForegroundService.error));}
}
