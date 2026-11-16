package com.fluency.biofeedback;

import android.media.AudioDeviceInfo;
import android.os.Build;

/** Prefer stereo media routes; keep the output restricted to private headphones. */
public final class HeadphoneRoutePolicy {
    private HeadphoneRoutePolicy() {}
    public static int priority(int type, int sdk) {
        if (type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES || type == AudioDeviceInfo.TYPE_WIRED_HEADSET || type == AudioDeviceInfo.TYPE_USB_HEADSET) return 100;
        if (type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP) return 80;
        if (sdk >= 31 && type == AudioDeviceInfo.TYPE_BLE_HEADSET) return 70;
        if (type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO) return 10;
        return 0;
    }
    public static boolean isHeadphone(int type, int sdk) { return priority(type, sdk) > 0; }
}
