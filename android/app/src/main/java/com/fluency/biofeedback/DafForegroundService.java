package com.fluency.biofeedback;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.*;
import android.os.*;
import androidx.core.app.NotificationCompat;
import androidx.core.content.ContextCompat;

public final class DafForegroundService extends Service {
    static final String STOP = "com.fluency.biofeedback.STOP_DAF";
    static volatile boolean running = false;
    static volatile String error = "";
    static volatile FeedbackProcessor processor;
    private static final String CHANNEL = "glide_daf";
    private volatile boolean stopping;
    private volatile boolean starting;
    private Thread audioThread;
    private AudioRecord recorder;
    private AudioTrack output;
    private AudioManager audioManager;
    private AudioDeviceCallback deviceCallback;
    private PowerManager.WakeLock wakeLock;

    static AudioDeviceInfo headphones(AudioManager manager) {
        for (AudioDeviceInfo d : manager.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            int t = d.getType();
            if (t == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || t == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
                t == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || t == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
                t == AudioDeviceInfo.TYPE_USB_HEADSET || (Build.VERSION.SDK_INT >= 31 && t == AudioDeviceInfo.TYPE_BLE_HEADSET)) return d;
        }
        return null;
    }
    @Override public void onCreate() { super.onCreate(); audioManager=(AudioManager)getSystemService(AUDIO_SERVICE); }
    @Override public int onStartCommand(Intent intent, int flags, int id) {
        if (intent == null || STOP.equals(intent.getAction())) { stopSelf(); return START_NOT_STICKY; }
        if (running || starting) return START_NOT_STICKY;
        starting=true;
        error="";
        try {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) throw new SecurityException("Chýba povolenie mikrofónu.");
            AudioDeviceInfo route = headphones(audioManager);
            if (route == null) throw new IllegalStateException("Pripoj slúchadlá a skús to znova.");
            if (Build.VERSION.SDK_INT >= 26) ((NotificationManager)getSystemService(NOTIFICATION_SERVICE)).createNotificationChannel(new NotificationChannel(CHANNEL,"Aktívny DAF asistent",NotificationManager.IMPORTANCE_LOW));
            Intent stop = new Intent(this,DafForegroundService.class).setAction(STOP);
            PendingIntent stopAction=PendingIntent.getService(this,1,stop,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Intent open = new Intent(this,MainActivity.class).setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent openAction=PendingIntent.getActivity(this,2,open,PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            Notification notification=new NotificationCompat.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.ic_btn_speak_now).setContentTitle("Glide: odposluch je zapnutý").setContentText("Mikrofón je aktívny. Ťuknutím sa vrátiš do aplikácie.").setContentIntent(openAction).setOngoing(true).addAction(0,"Vypnúť",stopAction).build();
            if (Build.VERSION.SDK_INT >= 29) startForeground(43,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE);
            else startForeground(43,notification);
            int delay=intent.getIntExtra("delay",70), volume=intent.getIntExtra("volume",70);
            stopping=false;
            deviceCallback=new AudioDeviceCallback(){ @Override public void onAudioDevicesRemoved(AudioDeviceInfo[] devices){ for(AudioDeviceInfo removed:devices) if(removed.getId()==route.getId()){ error="Slúchadlá boli odpojené."; stopSelf(); return; } }};
            audioManager.registerAudioDeviceCallback(deviceCallback,new Handler(Looper.getMainLooper()));
            PowerManager power=(PowerManager)getSystemService(POWER_SERVICE);
            wakeLock=power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Glide:DAF"); wakeLock.acquire();
            audioThread=new Thread(() -> runAudio(route,delay,volume,id),"Glide-DAF");
            audioThread.start();
        } catch (Exception ex) { error=ex.getMessage()==null?"Asistenta sa nepodarilo spustiť.":ex.getMessage(); stopSelf(); }
        return START_NOT_STICKY;
    }
    private void runAudio(AudioDeviceInfo route,int delay,int volume,int startId) {
        try {
            int rate=48000, chunk=480;
            int inputMin=AudioRecord.getMinBufferSize(rate,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT);
            int outputMin=AudioTrack.getMinBufferSize(rate,AudioFormat.CHANNEL_OUT_MONO,AudioFormat.ENCODING_PCM_16BIT);
            if(inputMin<=0||outputMin<=0) throw new IllegalStateException("Zvukové zariadenie nepodporuje odposluch.");
            recorder=new AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION,rate,AudioFormat.CHANNEL_IN_MONO,AudioFormat.ENCODING_PCM_16BIT,Math.max(inputMin,chunk*4));
            output=new AudioTrack.Builder().setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build()).setAudioFormat(new AudioFormat.Builder().setSampleRate(rate).setEncoding(AudioFormat.ENCODING_PCM_16BIT).setChannelMask(AudioFormat.CHANNEL_OUT_MONO).build()).setBufferSizeInBytes(Math.max(outputMin,chunk*4)).setTransferMode(AudioTrack.MODE_STREAM).build();
            if(recorder.getState()!=AudioRecord.STATE_INITIALIZED || output.getState()!=AudioTrack.STATE_INITIALIZED || !output.setPreferredDevice(route)) throw new IllegalStateException("Nepodarilo sa pripojiť slúchadlá.");
            processor=new FeedbackProcessor(rate); processor.setDelay(delay); processor.setVolume(volume);
            recorder.startRecording(); output.play();
            if(recorder.getRecordingState()!=AudioRecord.RECORDSTATE_RECORDING) throw new IllegalStateException("Mikrofón sa nepodarilo spustiť.");
            // Prime with silence; never send microphone audio until Android confirms the route.
            short[] samples=new short[chunk];
            for(int attempt=0;attempt<100 && !stopping;attempt++){
                AudioDeviceInfo connected=output.getRoutedDevice();
                if(connected!=null && connected.getId()==route.getId())break;
                if(connected!=null)throw new IllegalStateException("Zvuk nesmeruje do slúchadiel.");
                if(output.write(samples,0,samples.length)<=0)throw new IllegalStateException("Prehrávanie bolo prerušené.");
                if(attempt==99)throw new IllegalStateException("Nepodarilo sa overiť pripojenie slúchadiel.");
            }
            if(stopping)return;
            starting=false; running=true;
            while(!stopping){
                int count=recorder.read(samples,0,samples.length);
                if(count<=0) throw new IllegalStateException("Mikrofón prestal pracovať.");
                AudioDeviceInfo current=output.getRoutedDevice();
                if(current == null) continue;
                if(current.getId()!=route.getId()) throw new IllegalStateException("Slúchadlá boli odpojené.");
                processor.process(samples,count);
                int written=0;
                while(written<count && !stopping){int n=output.write(samples,written,count-written);if(n<=0)throw new IllegalStateException("Prehrávanie bolo prerušené.");written+=n;}
            }
        } catch(Exception ex) { if(!stopping) error=ex.getMessage()==null?"Zvuk sa prerušil.":ex.getMessage(); }
        finally { starting=false; running=false;processor=null; stopSelf(startId); }
    }
    @Override public void onDestroy() {
        stopping=true; running=false; processor=null;
        if(deviceCallback!=null)audioManager.unregisterAudioDeviceCallback(deviceCallback);
        try{if(recorder!=null)recorder.stop();}catch(Exception ignored){}
        try{if(output!=null)output.stop();}catch(Exception ignored){}
        if(audioThread!=null && audioThread!=Thread.currentThread()){try{audioThread.join(1000);}catch(InterruptedException ex){Thread.currentThread().interrupt();}}
        if(recorder!=null)recorder.release();if(output!=null)output.release();
        if(wakeLock!=null&&wakeLock.isHeld())wakeLock.release();
        super.onDestroy();
    }
    @Override public IBinder onBind(Intent intent){return null;}
}
