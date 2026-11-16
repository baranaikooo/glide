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
}
