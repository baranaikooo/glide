package com.fluency.biofeedback;

import android.content.*;
import android.media.*;
import android.os.Build;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/** A scoped duplex Bluetooth route. Release it as soon as the microphone is no longer needed. */
public final class BluetoothAudioRoute implements AutoCloseable {
    private final Context context;
    private final AudioManager audio;
    private final int oldMode;
    private volatile boolean closed;
    private boolean requested;
    public BluetoothAudioRoute(Context context) {
        this.context=context.getApplicationContext();
        audio=(AudioManager)this.context.getSystemService(Context.AUDIO_SERVICE);
        oldMode=audio.getMode();
    }
    public static boolean isBluetooth(AudioDeviceInfo device) {
        if(device==null)return false;
        int type=device.getType();
        return type==AudioDeviceInfo.TYPE_BLUETOOTH_A2DP || type==AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            (Build.VERSION.SDK_INT>=31 && type==AudioDeviceInfo.TYPE_BLE_HEADSET);
    }
    public static boolean isBluetoothMic(AudioDeviceInfo device) {
        return device!=null && (device.getType()==AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
            (Build.VERSION.SDK_INT>=31 && device.getType()==AudioDeviceInfo.TYPE_BLE_HEADSET));
    }
    public AudioDeviceInfo connect() throws Exception {
        synchronized(this) {
            if(closed) throw new IllegalStateException("Zvuková relácia bola zrušená.");
            audio.setMode(AudioManager.MODE_IN_COMMUNICATION);
            requested=true;
        }
        if(Build.VERSION.SDK_INT>=31) {
            AudioDeviceInfo target=null;
            for(AudioDeviceInfo candidate:audio.getAvailableCommunicationDevices()) {
                if(isBluetoothMic(candidate)){target=candidate;break;}
            }
            synchronized(this) {
                if(closed) throw new IllegalStateException("Zvuková relácia bola zrušená.");
                if(target==null || !audio.setCommunicationDevice(target)) throw new IllegalStateException("Mikrofón slúchadiel nie je dostupný. Skontroluj povolenie telefonovania pri slúchadlách v Bluetooth nastaveniach.");
            }
            for(int n=0;n<100 && !closed;n++) {
                AudioDeviceInfo selected=audio.getCommunicationDevice();
                if(selected!=null && selected.getId()==target.getId())return selected;
                Thread.sleep(100);
            }
            throw new IllegalStateException("Nepodarilo sa pripojiť mikrofón slúchadiel.");
        }
        CountDownLatch connected=new CountDownLatch(1);
        BroadcastReceiver receiver=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent intent){if(intent.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE,-1)==AudioManager.SCO_AUDIO_STATE_CONNECTED)connected.countDown();}};
        Intent last=context.registerReceiver(receiver,new IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED));
        try {
            if(last!=null && last.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE,-1)==AudioManager.SCO_AUDIO_STATE_CONNECTED)connected.countDown();
            synchronized(this) {
                if(closed) throw new IllegalStateException("Zvuková relácia bola zrušená.");
                audio.startBluetoothSco();
            }
            for(int n=0;n<100 && !closed;n++)if(connected.await(100,TimeUnit.MILLISECONDS))return null;
            throw new IllegalStateException("Nepodarilo sa pripojiť mikrofón slúchadiel.");
        } finally { context.unregisterReceiver(receiver); }
    }
    @Override public synchronized void close() {
        if(closed)return;
        closed=true;
        if(requested) {
            if(Build.VERSION.SDK_INT>=31)audio.clearCommunicationDevice(); else audio.stopBluetoothSco();
            audio.setMode(oldMode);
        }
    }
}
