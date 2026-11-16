package com.fluency.biofeedback;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioManager;
import android.media.AudioDeviceInfo;
import android.media.AudioRecordingConfiguration;
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
    private volatile BluetoothAudioRoute exerciseRoute;
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
        if(tries>=150){getContext().stopService(new Intent(getContext(),DafForegroundService.class));call.reject("Asistent sa nespustil včas.");return;}
        main.postDelayed(() -> pollStart(call,tries+1),100);
    }
    /** Use the Bluetooth headset microphone in the WebView exercise session as well. */
    @PluginMethod public void prepareExercise(PluginCall call) {
        AudioManager manager=(AudioManager)getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
        AudioDeviceInfo output=DafForegroundService.headphones(manager);
        if(!BluetoothAudioRoute.isBluetooth(output)){call.resolve(new JSObject().put("bluetooth",false));return;}
        if(DafForegroundService.running){call.reject("Pred cvičením vypni DAF asistenta.");return;}
        BluetoothAudioRoute route=new BluetoothAudioRoute(getContext());
        exerciseRoute=route;
        new Thread(() -> {
            try { route.connect(); if(exerciseRoute!=route){route.close();call.reject("Zvuková relácia bola zrušená.");return;} call.resolve(new JSObject().put("bluetooth",true)); }
            catch(Exception ex){route.close();if(exerciseRoute==route)exerciseRoute=null;call.reject(ex.getMessage()==null?"Mikrofón slúchadiel nie je dostupný.":ex.getMessage());}
        },"Glide-headset-route").start();
    }
    @PluginMethod public void verifyExercise(PluginCall call) {
        BluetoothAudioRoute route=exerciseRoute;
        if(route==null){call.resolve();return;}
        new Thread(() -> {
            AudioManager manager=(AudioManager)getContext().getSystemService(android.content.Context.AUDIO_SERVICE);
            try {
                for(int n=0;n<30 && exerciseRoute==route;n++){
                    for(AudioRecordingConfiguration config:manager.getActiveRecordingConfigurations()) {
                        if(BluetoothAudioRoute.isBluetoothMic(config.getAudioDevice())) {call.resolve();return;}
                    }
                    Thread.sleep(100);
                }
                call.reject("Android nepotvrdil mikrofón slúchadiel. Skontroluj povolenie telefonovania pri slúchadlách v Bluetooth nastaveniach.");
            } catch(Exception ex){call.reject("Mikrofón slúchadiel sa nepodarilo overiť.");}
        },"Glide-headset-verify").start();
    }
    @PluginMethod public void releaseExercise(PluginCall call) {
        BluetoothAudioRoute route=exerciseRoute;exerciseRoute=null;if(route!=null)route.close();call.resolve();
    }
    @Override protected void handleOnDestroy(){BluetoothAudioRoute route=exerciseRoute;exerciseRoute=null;if(route!=null)route.close();}
    @PluginMethod public void stop(PluginCall call){ getContext().stopService(new Intent(getContext(),DafForegroundService.class)); pollStop(call,0); }
    private void pollStop(PluginCall call,int tries){
        if(!DafForegroundService.serviceActive){call.resolve();return;}
        if(tries>=50){call.reject("Asistenta sa nepodarilo včas zastaviť.");return;}
        main.postDelayed(() -> pollStop(call,tries+1),100);
    }
    @PluginMethod public void setOptions(PluginCall call){ FeedbackProcessor p=DafForegroundService.processor; if(p==null || !DafForegroundService.running){call.reject("Asistent nie je aktívny.");return;} Integer d=call.getInt("delay");Integer v=call.getInt("volume");if(d!=null)p.setDelay(d);if(v!=null)p.setVolume(v);call.resolve(); }
    @PluginMethod public void status(PluginCall call){ FeedbackProcessor p=DafForegroundService.processor; JSObject result=new JSObject().put("active",DafForegroundService.running).put("error",DafForegroundService.error); if(p!=null){result.put("delay",p.getDelay());result.put("volume",p.getVolume());} call.resolve(result); }
}
