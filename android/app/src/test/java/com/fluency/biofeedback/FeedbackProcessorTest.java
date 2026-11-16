package com.fluency.biofeedback;
import org.junit.Test;
import static org.junit.Assert.*;
public class FeedbackProcessorTest {
    @Test public void delayMuteAndLimit() {
        int rate=48000; FeedbackProcessor p=new FeedbackProcessor(rate);p.setDelay(70);p.setVolume(100);
        short[] impulse=new short[rate];impulse[0]=12000;p.process(impulse,impulse.length);
        int first=-1;for(int i=0;i<impulse.length;i++)if(impulse[i]!=0){first=i;break;}
        assertEquals(3360,first);
        p=new FeedbackProcessor(rate);p.setVolume(0);short[] muted=new short[rate];java.util.Arrays.fill(muted,(short)12000);p.process(muted,muted.length);for(short value:muted)assertEquals(0,value);
        p=new FeedbackProcessor(rate);p.setVolume(100);short[] loud=new short[rate];java.util.Arrays.fill(loud,Short.MAX_VALUE);p.process(loud,loud.length);for(short value:loud)assertTrue(Math.abs((int)value)<=24576);
    }
    private double magnitude(short[] s,double freq){double re=0,im=0;for(int i=24000;i<s.length;i++){double x=2*Math.PI*freq*i/48000;re+=s[i]*Math.cos(x);im+=s[i]*Math.sin(x);}return Math.hypot(re,im);}
    @Test public void automaticPitchShiftProducesHigherTone() {
        short[] s=new short[96000];for(int i=0;i<s.length;i++)s[i]=(short)(10000*Math.sin(2*Math.PI*440*i/48000));
        FeedbackProcessor p=new FeedbackProcessor(48000);p.setVolume(100);p.process(s,s.length);
        assertTrue(magnitude(s,440*Math.pow(2,2.0/12))>2*magnitude(s,520));
    }
    @Test public void quietSpeechIsAudibleWithoutExceedingLimit() {
        FeedbackProcessor p = new FeedbackProcessor(48000); p.setVolume(70);
        short[] audio = new short[48000]; java.util.Arrays.fill(audio, (short)1000); p.process(audio,audio.length);
        assertTrue("quiet input should be boosted", Math.abs((int)audio[40000]) > 1800);
        for(short value:audio) assertTrue(Math.abs((int)value) <= 24576);
    }
    @Test public void stereoBluetoothPreferredButOnlyHeadphonesArePrivate() {
        assertTrue(HeadphoneRoutePolicy.priority(android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, 33) > HeadphoneRoutePolicy.priority(android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO, 33));
        assertTrue(HeadphoneRoutePolicy.isHeadphone(android.media.AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, 33));
        assertTrue(HeadphoneRoutePolicy.isHeadphone(android.media.AudioDeviceInfo.TYPE_BLE_HEADSET, 33));
        assertFalse(HeadphoneRoutePolicy.isHeadphone(android.media.AudioDeviceInfo.TYPE_BUILTIN_SPEAKER, 33));
    }
    @Test public void volumeRemainsProportionalForLoudSignals() {
        short[] full=new short[48000],quiet=new short[48000];
        java.util.Arrays.fill(full,Short.MAX_VALUE);java.util.Arrays.fill(quiet,Short.MAX_VALUE);
        FeedbackProcessor a=new FeedbackProcessor(48000),b=new FeedbackProcessor(48000);
        a.setVolume(100);b.setVolume(25);a.process(full,full.length);b.process(quiet,quiet.length);
        assertTrue(Math.abs(full[40000])>1000);
        assertEquals(Math.abs(full[40000])*.25,Math.abs(quiet[40000]),2);
        assertEquals(25,b.getVolume());assertEquals(70,b.getDelay());
    }
}
