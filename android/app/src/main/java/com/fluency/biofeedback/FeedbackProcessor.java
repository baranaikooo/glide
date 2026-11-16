package com.fluency.biofeedback;

/** Fixed-size, allocation-free delayed and pitch-shifted monitoring. Not a clinical assessment. */
public final class FeedbackProcessor {
    private final float[] ring;
    private final int sampleRate;
    private int position;
    private double phase;
    private volatile int delayMs = 70;
    private volatile float volume = .70f;
    private final double shift = Math.pow(2, 2.0 / 12.0);
    private final double grain = .04;

    public FeedbackProcessor(int rate) { sampleRate = rate; ring = new float[rate]; }
    public void setDelay(int ms) { delayMs = Math.max(40, Math.min(140, ms)); }
    public void setVolume(int percent) { volume = Math.max(0, Math.min(100, percent)) / 100f; }
    private float read(double delay) {
        double pos = position - delay;
        while (pos < 0) pos += ring.length;
        int a = ((int) pos) % ring.length, b = (a + 1) % ring.length;
        return (float)(ring[a] + (ring[b] - ring[a]) * (pos - Math.floor(pos)));
    }
    public void process(short[] samples, int count) {
        double d = delayMs * sampleRate / 1000.0;
        float gain = volume;
        for (int i = 0; i < count; i++) {
            ring[position] = samples[i] / 32768f;
            double p2 = (phase + .5) % 1.0;
            float direct = read(d);
            float pitched = (float)(read(d + sampleRate * (.003 + grain * (1 - phase))) * Math.sin(Math.PI * phase)
                + read(d + sampleRate * (.003 + grain * (1 - p2))) * Math.sin(Math.PI * p2));
            float amplified = (direct * .5f + pitched * .35f) * gain * 2.5f;
            // Smooth limiter prevents hard clipping while giving quiet microphone signals more headroom.
            float value = amplified / (1f + Math.abs(amplified) / .75f);
            samples[i] = (short)(value * 32767);
            position = (position + 1) % ring.length;
            phase = (phase + (shift - 1) / (grain * sampleRate)) % 1.0;
        }
    }
}
